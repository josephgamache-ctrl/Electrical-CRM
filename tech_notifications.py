@app.post("/notifications/generate-technician")
async def generate_technician_notifications(current_user: dict = Depends(get_current_user)):
    """
    Generate notifications specifically for technicians about their assigned jobs.
    Can be called manually or scheduled via cron.
    """
    conn = get_db_connection()
    cur = conn.cursor()
    notifications_created = 0

    try:
        # Get all active technicians
        cur.execute("""
            SELECT username FROM users
            WHERE role = 'technician' AND active = TRUE
        """)
        technicians = [row['username'] for row in cur.fetchall()]

        for tech_username in technicians:
            # ============================================================
            # 1. UPCOMING JOB REMINDERS (Tomorrow)
            # ============================================================
            cur.execute("""
                SELECT
                    jsd.id as schedule_id,
                    jsd.work_order_id,
                    jsd.scheduled_date,
                    jsd.start_time,
                    jsd.phase_name,
                    wo.work_order_number,
                    wo.job_description,
                    c.first_name || ' ' || c.last_name as customer_name,
                    c.service_street || ', ' || c.service_city as job_address
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                JOIN customers c ON wo.customer_id = c.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date = CURRENT_DATE + INTERVAL '1 day'
                  AND jsd.status != 'cancelled'
                  AND wo.status NOT IN ('completed', 'cancelled', 'invoiced')
            """, (tech_username,))

            for job in cur.fetchall():
                dedup_key = f"upcoming_job_{tech_username}_{job['schedule_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    start_time = job['start_time'].strftime('%I:%M %p') if job['start_time'] else 'TBD'
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'schedule', 'upcoming_job',
                            %s, %s, 'info', 'work_order', %s,
                            %s, %s, %s::date + INTERVAL '2 days'
                        )
                    """, (
                        tech_username,
                        f"Tomorrow: {job['work_order_number']}",
                        f"{job['job_description']} at {job['customer_name']}. Start: {start_time}. Address: {job['job_address']}",
                        job['work_order_id'],
                        f"/jobs/{job['work_order_id']}",
                        dedup_key,
                        job['scheduled_date']
                    ))
                    notifications_created += 1

            # ============================================================
            # 2. TODAY'S JOBS (Morning reminder)
            # ============================================================
            cur.execute("""
                SELECT
                    jsd.id as schedule_id,
                    jsd.work_order_id,
                    jsd.scheduled_date,
                    jsd.start_time,
                    wo.work_order_number,
                    wo.job_description,
                    c.first_name || ' ' || c.last_name as customer_name,
                    c.service_street || ', ' || c.service_city as job_address
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                JOIN customers c ON wo.customer_id = c.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date = CURRENT_DATE
                  AND jsd.status != 'cancelled'
                  AND wo.status NOT IN ('completed', 'cancelled', 'invoiced')
            """, (tech_username,))

            for job in cur.fetchall():
                dedup_key = f"today_job_{tech_username}_{job['schedule_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    start_time = job['start_time'].strftime('%I:%M %p') if job['start_time'] else 'TBD'
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'schedule', 'today_job',
                            %s, %s, 'warning', 'work_order', %s,
                            %s, %s, CURRENT_DATE + INTERVAL '1 day'
                        )
                    """, (
                        tech_username,
                        f"Today: {job['work_order_number']}",
                        f"{job['job_description']} at {job['customer_name']}. Start: {start_time}. Address: {job['job_address']}",
                        job['work_order_id'],
                        f"/jobs/{job['work_order_id']}",
                        dedup_key
                    ))
                    notifications_created += 1

            # ============================================================
            # 3. MATERIAL SHORTAGES FOR ASSIGNED JOBS
            # ============================================================
            cur.execute("""
                SELECT DISTINCT
                    wo.id as work_order_id,
                    wo.work_order_number,
                    i.item_id,
                    i.description as item_description,
                    jmu.quantity_needed,
                    jmu.quantity_allocated,
                    jmu.stock_status
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                JOIN job_materials_used jmu ON jmu.work_order_id = wo.id
                JOIN inventory i ON jmu.inventory_id = i.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date >= CURRENT_DATE
                  AND jsd.scheduled_date <= CURRENT_DATE + INTERVAL '7 days'
                  AND jsd.status != 'cancelled'
                  AND wo.status NOT IN ('completed', 'cancelled', 'invoiced')
                  AND jmu.stock_status IN ('shortage', 'partial')
            """, (tech_username,))

            for material in cur.fetchall():
                shortage = material['quantity_needed'] - (material['quantity_allocated'] or 0)
                dedup_key = f"material_shortage_{tech_username}_{material['work_order_id']}_{material['item_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'inventory', 'material_shortage',
                            %s, %s, 'warning', 'work_order', %s,
                            %s, %s, CURRENT_TIMESTAMP + INTERVAL '7 days'
                        )
                    """, (
                        tech_username,
                        f"Material Shortage: {material['work_order_number']}",
                        f"{material['item_description']} - Need {material['quantity_needed']}, only {material['quantity_allocated'] or 0} allocated (short {shortage})",
                        material['work_order_id'],
                        f"/jobs/{material['work_order_id']}/materials",
                        dedup_key
                    ))
                    notifications_created += 1

            # ============================================================
            # 4. MATERIALS READY FOR PICKUP
            # ============================================================
            cur.execute("""
                SELECT DISTINCT
                    wo.id as work_order_id,
                    wo.work_order_number,
                    wo.job_description,
                    COUNT(*) as items_ready
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                JOIN job_materials_used jmu ON jmu.work_order_id = wo.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date >= CURRENT_DATE
                  AND jsd.scheduled_date <= CURRENT_DATE + INTERVAL '3 days'
                  AND jsd.status != 'cancelled'
                  AND wo.status NOT IN ('completed', 'cancelled', 'invoiced')
                  AND jmu.quantity_allocated > 0
                  AND (jmu.quantity_loaded IS NULL OR jmu.quantity_loaded = 0)
                  AND jmu.status = 'allocated'
                GROUP BY wo.id, wo.work_order_number, wo.job_description
            """, (tech_username,))

            for job in cur.fetchall():
                dedup_key = f"materials_ready_{tech_username}_{job['work_order_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'inventory', 'materials_ready',
                            %s, %s, 'info', 'work_order', %s,
                            %s, %s, CURRENT_TIMESTAMP + INTERVAL '3 days'
                        )
                    """, (
                        tech_username,
                        f"Materials Ready: {job['work_order_number']}",
                        f"{job['items_ready']} items allocated and ready for pickup for {job['job_description']}",
                        job['work_order_id'],
                        f"/jobs/{job['work_order_id']}/materials",
                        dedup_key
                    ))
                    notifications_created += 1

            # ============================================================
            # 5. MISSING TIME ENTRIES (Worked but didn't log hours)
            # ============================================================
            cur.execute("""
                SELECT
                    jsd.work_order_id,
                    jsd.scheduled_date,
                    wo.work_order_number,
                    jsc.scheduled_hours
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                WHERE jsc.employee_username = %s
                  AND jsd.scheduled_date < CURRENT_DATE
                  AND jsd.scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
                  AND jsd.status NOT IN ('cancelled')
                  AND NOT EXISTS (
                      SELECT 1 FROM time_entries te
                      WHERE te.work_order_id = jsd.work_order_id
                        AND te.employee_username = %s
                        AND te.work_date = jsd.scheduled_date
                  )
            """, (tech_username, tech_username))

            for missing in cur.fetchall():
                dedup_key = f"missing_time_{tech_username}_{missing['work_order_id']}_{missing['scheduled_date']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'timesheet', 'missing_entry',
                            %s, %s, 'warning', 'work_order', %s,
                            %s, %s, CURRENT_TIMESTAMP + INTERVAL '7 days'
                        )
                    """, (
                        tech_username,
                        f"Missing Hours: {missing['work_order_number']}",
                        f"You were scheduled on {missing['scheduled_date']} but haven't logged time yet.",
                        missing['work_order_id'],
                        f"/time-entry?date={missing['scheduled_date']}",
                        dedup_key
                    ))
                    notifications_created += 1

            # ============================================================
            # 6. MATERIALS NEED RETURN (Completed jobs with unreturned materials)
            # ============================================================
            cur.execute("""
                SELECT DISTINCT
                    wo.id as work_order_id,
                    wo.work_order_number,
                    wo.job_description,
                    SUM(COALESCE(jmu.quantity_loaded, 0) - COALESCE(jmu.quantity_used, 0) - COALESCE(jmu.quantity_returned, 0)) as unreturned
                FROM job_schedule_crew jsc
                JOIN job_schedule_dates jsd ON jsc.job_schedule_date_id = jsd.id
                JOIN work_orders wo ON jsd.work_order_id = wo.id
                JOIN job_materials_used jmu ON jmu.work_order_id = wo.id
                WHERE jsc.employee_username = %s
                  AND wo.status = 'completed'
                  AND COALESCE(jmu.quantity_loaded, 0) > 0
                  AND (COALESCE(jmu.quantity_loaded, 0) - COALESCE(jmu.quantity_used, 0) - COALESCE(jmu.quantity_returned, 0)) > 0
                GROUP BY wo.id, wo.work_order_number, wo.job_description
                HAVING SUM(COALESCE(jmu.quantity_loaded, 0) - COALESCE(jmu.quantity_used, 0) - COALESCE(jmu.quantity_returned, 0)) > 0
            """, (tech_username,))

            for job in cur.fetchall():
                dedup_key = f"materials_return_{tech_username}_{job['work_order_id']}"
                cur.execute("SELECT id FROM notifications WHERE dedup_key = %s AND is_dismissed = FALSE", (dedup_key,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO notifications (
                            target_username, notification_type, notification_subtype,
                            title, message, severity, related_entity_type, related_entity_id,
                            action_url, dedup_key, expires_at
                        ) VALUES (
                            %s, 'inventory', 'materials_return',
                            %s, %s, 'warning', 'work_order', %s,
                            %s, %s, CURRENT_TIMESTAMP + INTERVAL '14 days'
                        )
                    """, (
                        tech_username,
                        f"Return Materials: {job['work_order_number']}",
                        f"Job completed - {int(job['unreturned'])} unused items need to be returned to inventory.",
                        job['work_order_id'],
                        f"/jobs/{job['work_order_id']}/materials",
                        dedup_key
                    ))
                    notifications_created += 1

        conn.commit()

        return {
            "message": f"Generated {notifications_created} technician notifications",
            "notifications_created": notifications_created,
            "technicians_processed": len(technicians)
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

