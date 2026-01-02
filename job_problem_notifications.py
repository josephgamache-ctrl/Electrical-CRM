@app.post("/notifications/generate-job-problems")
async def generate_job_problem_notifications(current_user: dict = Depends(get_current_user)):
    """
    Generate notifications for job problems that need manager attention:
    - Jobs scheduled soon with no crew assigned
    - Jobs with material shortages close to start date
    - Jobs scheduled but materials not allocated

    These notifications go to managers/admins, not technicians.
    """
    if current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Not authorized")

    conn = get_db_connection()
    cur = conn.cursor()
    notifications_created = 0

    try:
        # Get all managers and admins to notify
        cur.execute("""
            SELECT username FROM users
            WHERE role IN ('admin', 'manager') AND active = TRUE
        """)
        managers = [row['username'] for row in cur.fetchall()]

        # ============================================================
        # 1. JOBS STARTING SOON WITH NO CREW (next 3 days)
        # ============================================================
        cur.execute("""
            SELECT DISTINCT
                jsd.id as schedule_id,
                jsd.work_order_id,
                jsd.scheduled_date,
                jsd.start_time,
                wo.work_order_number,
                wo.job_description,
                c.first_name || ' ' || c.last_name as customer_name,
                (jsd.scheduled_date - CURRENT_DATE) as days_until
            FROM job_schedule_dates jsd
            JOIN work_orders wo ON jsd.work_order_id = wo.id
            JOIN customers c ON wo.customer_id = c.id
            LEFT JOIN job_schedule_crew jsc ON jsc.job_schedule_date_id = jsd.id
            WHERE jsd.scheduled_date >= CURRENT_DATE
              AND jsd.scheduled_date <= CURRENT_DATE + INTERVAL '3 days'
              AND jsd.status NOT IN ('cancelled', 'completed')
              AND wo.status NOT IN ('completed', 'cancelled', 'invoiced')
            GROUP BY jsd.id, jsd.work_order_id, jsd.scheduled_date, jsd.start_time,
                     wo.work_order_number, wo.job_description, c.first_name, c.last_name
            HAVING COUNT(jsc.id) = 0
        """)

        no_crew_jobs = cur.fetchall()
        for job in no_crew_jobs:
            days = job['days_until']
            if days == 0:
                severity = 'error'
                urgency = "TODAY"
            elif days == 1:
                severity = 'error'
                urgency = "TOMORROW"
            else:
                severity = 'warning'
                urgency = f"in {days} days"

            for manager in managers:
                dedup_key = f"no_crew_{manager}_{job['schedule_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'work_order', 'no_crew',
                            %s, %s, %s, 'work_order', %s,
                            %s, %s, %s::date + INTERVAL '1 day'
                        )
                    """, (
                        manager,
                        f"No Crew: {job['work_order_number']} ({urgency})",
                        f"{job['job_description']} for {job['customer_name']} on {job['scheduled_date']} has no crew assigned!",
                        severity,
                        job['work_order_id'],
                        f"/calendar?date={job['scheduled_date']}",
                        dedup_key,
                        job['scheduled_date']
                    ))
                    notifications_created += 1

        # ============================================================
        # 2. JOBS WITH MATERIAL SHORTAGES (next 5 days)
        # ============================================================
        cur.execute("""
            SELECT DISTINCT
                wo.id as work_order_id,
                wo.work_order_number,
                wo.job_description,
                c.first_name || ' ' || c.last_name as customer_name,
                MIN(jsd.scheduled_date) as first_scheduled_date,
                (MIN(jsd.scheduled_date) - CURRENT_DATE) as days_until,
                COUNT(DISTINCT jmu.id) as shortage_count,
                SUM(jmu.quantity_needed - COALESCE(jmu.quantity_allocated, 0)) as total_shortage
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            JOIN job_schedule_dates jsd ON jsd.work_order_id = wo.id
            JOIN job_materials_used jmu ON jmu.work_order_id = wo.id
            WHERE jsd.scheduled_date >= CURRENT_DATE
              AND jsd.scheduled_date <= CURRENT_DATE + INTERVAL '5 days'
              AND jsd.status NOT IN ('cancelled', 'completed')
              AND wo.status NOT IN ('completed', 'cancelled', 'invoiced')
              AND jmu.stock_status IN ('shortage', 'partial')
            GROUP BY wo.id, wo.work_order_number, wo.job_description, c.first_name, c.last_name
        """)

        shortage_jobs = cur.fetchall()
        for job in shortage_jobs:
            days = job['days_until']
            if days <= 1:
                severity = 'error'
            elif days <= 3:
                severity = 'warning'
            else:
                severity = 'info'

            for manager in managers:
                dedup_key = f"material_shortage_mgr_{manager}_{job['work_order_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'work_order', 'material_shortage',
                            %s, %s, %s, 'work_order', %s,
                            %s, %s, %s::date + INTERVAL '1 day'
                        )
                    """, (
                        manager,
                        f"Material Shortage: {job['work_order_number']}",
                        f"{job['shortage_count']} items short for {job['customer_name']}. Job starts {job['first_scheduled_date']} ({days} days).",
                        severity,
                        job['work_order_id'],
                        f"/jobs/{job['work_order_id']}/materials",
                        dedup_key,
                        job['first_scheduled_date']
                    ))
                    notifications_created += 1

        # ============================================================
        # 3. JOBS SCHEDULED BUT NO MATERIALS ALLOCATED (next 3 days)
        # ============================================================
        cur.execute("""
            SELECT DISTINCT
                wo.id as work_order_id,
                wo.work_order_number,
                wo.job_description,
                c.first_name || ' ' || c.last_name as customer_name,
                MIN(jsd.scheduled_date) as first_scheduled_date,
                (MIN(jsd.scheduled_date) - CURRENT_DATE) as days_until,
                COUNT(DISTINCT jmu.id) as material_count,
                SUM(jmu.quantity_needed) as total_needed,
                SUM(COALESCE(jmu.quantity_allocated, 0)) as total_allocated
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            JOIN job_schedule_dates jsd ON jsd.work_order_id = wo.id
            JOIN job_materials_used jmu ON jmu.work_order_id = wo.id
            WHERE jsd.scheduled_date >= CURRENT_DATE
              AND jsd.scheduled_date <= CURRENT_DATE + INTERVAL '3 days'
              AND jsd.status NOT IN ('cancelled', 'completed')
              AND wo.status NOT IN ('completed', 'cancelled', 'invoiced')
            GROUP BY wo.id, wo.work_order_number, wo.job_description, c.first_name, c.last_name
            HAVING SUM(COALESCE(jmu.quantity_allocated, 0)) = 0
        """)

        no_allocation_jobs = cur.fetchall()
        for job in no_allocation_jobs:
            days = job['days_until']
            if days == 0:
                severity = 'error'
            elif days == 1:
                severity = 'error'
            else:
                severity = 'warning'

            for manager in managers:
                dedup_key = f"no_allocation_{manager}_{job['work_order_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'work_order', 'no_allocation',
                            %s, %s, %s, 'work_order', %s,
                            %s, %s, %s::date + INTERVAL '1 day'
                        )
                    """, (
                        manager,
                        f"No Materials Allocated: {job['work_order_number']}",
                        f"{job['material_count']} materials needed but none allocated. Job for {job['customer_name']} starts {job['first_scheduled_date']}.",
                        severity,
                        job['work_order_id'],
                        f"/jobs/{job['work_order_id']}/materials",
                        dedup_key,
                        job['first_scheduled_date']
                    ))
                    notifications_created += 1

        # ============================================================
        # 4. OVERDUE JOBS (past scheduled date, not completed)
        # ============================================================
        cur.execute("""
            SELECT DISTINCT
                wo.id as work_order_id,
                wo.work_order_number,
                wo.job_description,
                c.first_name || ' ' || c.last_name as customer_name,
                wo.scheduled_date,
                (CURRENT_DATE - wo.scheduled_date) as days_overdue
            FROM work_orders wo
            JOIN customers c ON wo.customer_id = c.id
            WHERE wo.scheduled_date < CURRENT_DATE
              AND wo.status NOT IN ('completed', 'cancelled', 'invoiced')
        """)

        overdue_jobs = cur.fetchall()
        for job in overdue_jobs:
            days_overdue = job['days_overdue']
            if days_overdue >= 7:
                severity = 'error'
            elif days_overdue >= 3:
                severity = 'warning'
            else:
                severity = 'warning'

            for manager in managers:
                dedup_key = f"overdue_{manager}_{job['work_order_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'work_order', 'overdue',
                            %s, %s, %s, 'work_order', %s,
                            %s, %s, CURRENT_TIMESTAMP + INTERVAL '7 days'
                        )
                    """, (
                        manager,
                        f"Overdue: {job['work_order_number']}",
                        f"{job['job_description']} for {job['customer_name']} was scheduled for {job['scheduled_date']} ({days_overdue} days ago).",
                        severity,
                        job['work_order_id'],
                        f"/jobs/{job['work_order_id']}",
                        dedup_key
                    ))
                    notifications_created += 1

        conn.commit()

        return {
            "message": f"Generated {notifications_created} job problem notifications",
            "notifications_created": notifications_created,
            "managers_notified": len(managers),
            "problems_found": {
                "no_crew": len(no_crew_jobs),
                "material_shortages": len(shortage_jobs),
                "no_allocation": len(no_allocation_jobs),
                "overdue": len(overdue_jobs)
            }
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()


@app.post("/notifications/generate-all")
async def generate_all_notifications(current_user: dict = Depends(get_current_user)):
    """
    Master endpoint to generate all types of notifications.
    Should be called daily (e.g., via cron job).
    """
    if current_user['role'] not in ['admin', 'manager']:
        raise HTTPException(status_code=403, detail="Not authorized")

    results = {}

    # Generate technician notifications
    try:
        tech_result = await generate_technician_notifications(current_user)
        results['technician'] = tech_result
    except Exception as e:
        results['technician'] = {"error": str(e)}

    # Generate job problem notifications
    try:
        problem_result = await generate_job_problem_notifications(current_user)
        results['job_problems'] = problem_result
    except Exception as e:
        results['job_problems'] = {"error": str(e)}

    total = sum(
        r.get('notifications_created', 0)
        for r in results.values()
        if isinstance(r, dict) and 'notifications_created' in r
    )

    return {
        "message": f"Generated {total} total notifications",
        "total_notifications": total,
        "details": results
    }

