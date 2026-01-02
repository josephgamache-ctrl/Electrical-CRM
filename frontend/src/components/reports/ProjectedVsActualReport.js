import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PeriodSelector from './PeriodSelector';
import './ProjectedVsActualReport.css';
import logger from '../../utils/logger';
const API_BASE = '/api';

const ProjectedVsActualReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [period, setPeriod] = useState({
    period: 'monthly',
    startDate: null,
    endDate: null
  });

  const [statusFilter, setStatusFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'completed', label: 'Completed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'pending', label: 'Pending' }
  ];

  const jobTypes = [
    { value: '', label: 'All Job Types' },
    { value: 'installation', label: 'Installation' },
    { value: 'repair', label: 'Repair' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'emergency', label: 'Emergency' }
  ];

  useEffect(() => {
    fetchReportData();
  }, [period, statusFilter, jobTypeFilter]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const params = {
        period: period.period
      };

      if (period.startDate) params.start_date = period.startDate;
      if (period.endDate) params.end_date = period.endDate;
      if (statusFilter) params.status = statusFilter;
      if (jobTypeFilter) params.job_type = jobTypeFilter;

      const response = await axios.get(`${API_BASE}/reports/variance/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setReportData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load variance report');
      logger.error('Variance report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobDetails = async (workOrderId) => {
    setDetailsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE}/reports/variance/job/${workOrderId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJobDetails(response.data);
      setSelectedJob(workOrderId);
    } catch (err) {
      logger.error('Job variance details fetch error:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const formatHours = (hours) => {
    return `${parseFloat(hours || 0).toFixed(2)} hrs`;
  };

  const formatPercent = (value) => {
    const num = parseFloat(value || 0);
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toFixed(1)}%`;
  };

  const getVarianceClass = (variance, invertColors = false) => {
    const num = parseFloat(variance || 0);
    if (num === 0) return 'variance-neutral';
    if (invertColors) {
      return num > 0 ? 'variance-positive' : 'variance-negative';
    }
    return num > 0 ? 'variance-negative' : 'variance-positive';
  };

  const VarianceRow = ({ label, projected, actual, variance, variancePercent, formatFn = formatCurrency, invertColors = false }) => (
    <div className="variance-row">
      <div className="variance-label">{label}</div>
      <div className="variance-projected">{formatFn(projected)}</div>
      <div className="variance-actual">{formatFn(actual)}</div>
      <div className={`variance-diff ${getVarianceClass(variance, invertColors)}`}>
        {variance > 0 ? '+' : ''}{formatFn(variance)}
      </div>
      <div className={`variance-percent ${getVarianceClass(variancePercent, invertColors)}`}>
        {formatPercent(variancePercent)}
      </div>
    </div>
  );

  if (loading && !reportData) {
    return (
      <div className="report-loading">
        <div className="loading-spinner"></div>
        <p>Loading variance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-error">
        <span className="error-icon">⚠️</span>
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button onClick={fetchReportData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="projected-vs-actual-report">
      <div className="report-header">
        <h1>
          <span className="report-icon">📊</span>
          Projected vs Actual Report
        </h1>
        <p className="report-subtitle">
          Compare estimated hours, materials, and costs against actual recorded values
        </p>
      </div>

      <div className="report-controls">
        <PeriodSelector value={period} onChange={setPeriod} />

        <div className="filter-group">
          <div className="filter-item">
            <label htmlFor="statusFilter" className="filter-label">
              <span className="filter-icon">📋</span>
              Status
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <label htmlFor="jobTypeFilter" className="filter-label">
              <span className="filter-icon">🔧</span>
              Job Type
            </label>
            <select
              id="jobTypeFilter"
              value={jobTypeFilter}
              onChange={(e) => setJobTypeFilter(e.target.value)}
              className="filter-select"
            >
              {jobTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {reportData && (
        <>
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card hours">
              <div className="card-icon">⏱️</div>
              <div className="card-content">
                <div className="card-label">Hours Variance</div>
                <div className="card-values">
                  <div className="value-row">
                    <span className="value-label">Projected:</span>
                    <span className="value-amount">{formatHours(reportData.summary?.total_projected_hours)}</span>
                  </div>
                  <div className="value-row">
                    <span className="value-label">Actual:</span>
                    <span className="value-amount">{formatHours(reportData.summary?.total_actual_hours)}</span>
                  </div>
                  <div className={`value-row variance ${getVarianceClass(reportData.summary?.total_hours_variance)}`}>
                    <span className="value-label">Variance:</span>
                    <span className="value-amount">
                      {reportData.summary?.total_hours_variance > 0 ? '+' : ''}
                      {formatHours(reportData.summary?.total_hours_variance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="summary-card labor-cost">
              <div className="card-icon">💰</div>
              <div className="card-content">
                <div className="card-label">Labor Cost Variance</div>
                <div className="card-values">
                  <div className="value-row">
                    <span className="value-label">Projected:</span>
                    <span className="value-amount">{formatCurrency(reportData.summary?.total_projected_labor_cost)}</span>
                  </div>
                  <div className="value-row">
                    <span className="value-label">Actual:</span>
                    <span className="value-amount">{formatCurrency(reportData.summary?.total_actual_labor_cost)}</span>
                  </div>
                  <div className={`value-row variance ${getVarianceClass(reportData.summary?.total_labor_cost_variance)}`}>
                    <span className="value-label">Variance:</span>
                    <span className="value-amount">
                      {reportData.summary?.total_labor_cost_variance > 0 ? '+' : ''}
                      {formatCurrency(reportData.summary?.total_labor_cost_variance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="summary-card material-cost">
              <div className="card-icon">📦</div>
              <div className="card-content">
                <div className="card-label">Material Cost Variance</div>
                <div className="card-values">
                  <div className="value-row">
                    <span className="value-label">Projected:</span>
                    <span className="value-amount">{formatCurrency(reportData.summary?.total_projected_material_cost)}</span>
                  </div>
                  <div className="value-row">
                    <span className="value-label">Actual:</span>
                    <span className="value-amount">{formatCurrency(reportData.summary?.total_actual_material_cost)}</span>
                  </div>
                  <div className={`value-row variance ${getVarianceClass(reportData.summary?.total_material_cost_variance)}`}>
                    <span className="value-label">Variance:</span>
                    <span className="value-amount">
                      {reportData.summary?.total_material_cost_variance > 0 ? '+' : ''}
                      {formatCurrency(reportData.summary?.total_material_cost_variance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="summary-card total">
              <div className="card-icon">📈</div>
              <div className="card-content">
                <div className="card-label">Total Cost Variance</div>
                <div className="card-values">
                  <div className="value-row">
                    <span className="value-label">Projected:</span>
                    <span className="value-amount">{formatCurrency(reportData.summary?.total_projected_cost)}</span>
                  </div>
                  <div className="value-row">
                    <span className="value-label">Actual:</span>
                    <span className="value-amount">{formatCurrency(reportData.summary?.total_actual_cost)}</span>
                  </div>
                  <div className={`value-row variance ${getVarianceClass(reportData.summary?.total_cost_variance)}`}>
                    <span className="value-label">Variance:</span>
                    <span className="value-amount">
                      {reportData.summary?.total_cost_variance > 0 ? '+' : ''}
                      {formatCurrency(reportData.summary?.total_cost_variance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Jobs Table */}
          <div className="jobs-variance-table">
            <div className="table-header">
              <h2>Jobs Variance Breakdown</h2>
              <div className="jobs-count">{reportData.jobs?.length || 0} jobs</div>
            </div>

            <div className="table-wrapper">
              <table className="variance-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Work Order</th>
                    <th rowSpan={2}>Customer</th>
                    <th rowSpan={2}>Status</th>
                    <th colSpan={3} className="group-header hours-group">Hours</th>
                    <th colSpan={3} className="group-header labor-group">Labor Cost</th>
                    <th colSpan={3} className="group-header material-group">Material Cost</th>
                  </tr>
                  <tr>
                    <th className="sub-header">Proj</th>
                    <th className="sub-header">Actual</th>
                    <th className="sub-header">Var</th>
                    <th className="sub-header">Proj</th>
                    <th className="sub-header">Actual</th>
                    <th className="sub-header">Var</th>
                    <th className="sub-header">Proj</th>
                    <th className="sub-header">Actual</th>
                    <th className="sub-header">Var</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.jobs?.map((job) => (
                    <tr
                      key={job.work_order_id}
                      className="job-row clickable"
                      onClick={() => fetchJobDetails(job.work_order_id)}
                    >
                      <td className="work-order-cell">
                        <span className="wo-number">{job.work_order_number}</span>
                        {job.job_type && (
                          <span className="job-type-badge">{job.job_type}</span>
                        )}
                      </td>
                      <td className="customer-cell">{job.customer_name}</td>
                      <td>
                        <span className={`status-badge status-${job.status}`}>
                          {job.status}
                        </span>
                      </td>
                      {/* Hours */}
                      <td className="number-cell">{parseFloat(job.projected_hours || 0).toFixed(1)}</td>
                      <td className="number-cell">{parseFloat(job.actual_hours || 0).toFixed(1)}</td>
                      <td className={`number-cell ${getVarianceClass(job.hours_variance)}`}>
                        {job.hours_variance > 0 ? '+' : ''}{parseFloat(job.hours_variance || 0).toFixed(1)}
                      </td>
                      {/* Labor Cost */}
                      <td className="number-cell">{formatCurrency(job.projected_labor_cost)}</td>
                      <td className="number-cell">{formatCurrency(job.actual_labor_cost)}</td>
                      <td className={`number-cell ${getVarianceClass(job.labor_cost_variance)}`}>
                        {job.labor_cost_variance > 0 ? '+' : ''}{formatCurrency(job.labor_cost_variance)}
                      </td>
                      {/* Material Cost */}
                      <td className="number-cell">{formatCurrency(job.projected_material_cost)}</td>
                      <td className="number-cell">{formatCurrency(job.actual_material_cost)}</td>
                      <td className={`number-cell ${getVarianceClass(job.material_cost_variance)}`}>
                        {job.material_cost_variance > 0 ? '+' : ''}{formatCurrency(job.material_cost_variance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(!reportData.jobs || reportData.jobs.length === 0) && (
              <div className="no-data-message">
                <span className="no-data-icon">📭</span>
                <p>No jobs found for the selected period and filters.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="job-details-modal" onClick={() => { setSelectedJob(null); setJobDetails(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="modal-icon">📊</span>
                {jobDetails?.summary?.work_order_number || 'Loading...'}
              </h2>
              <button className="modal-close" onClick={() => { setSelectedJob(null); setJobDetails(null); }}>
                ✕
              </button>
            </div>

            {detailsLoading ? (
              <div className="modal-loading">
                <div className="loading-spinner"></div>
                <p>Loading job details...</p>
              </div>
            ) : jobDetails ? (
              <div className="modal-body">
                {/* Summary Section */}
                <div className="detail-section">
                  <h3 className="section-title">
                    <span className="section-icon">📋</span>
                    Job Summary
                  </h3>
                  <div className="summary-info">
                    <div className="info-row">
                      <span className="info-label">Customer:</span>
                      <span className="info-value">{jobDetails.summary?.customer_name}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Status:</span>
                      <span className={`status-badge status-${jobDetails.summary?.status}`}>
                        {jobDetails.summary?.status}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Address:</span>
                      <span className="info-value">{jobDetails.summary?.service_address || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="variance-grid">
                    <div className="variance-header">
                      <span></span>
                      <span>Projected</span>
                      <span>Actual</span>
                      <span>Variance</span>
                      <span>%</span>
                    </div>
                    <VarianceRow
                      label="Hours"
                      projected={jobDetails.summary?.projected_hours}
                      actual={jobDetails.summary?.actual_hours}
                      variance={jobDetails.summary?.hours_variance}
                      variancePercent={jobDetails.summary?.hours_variance_percent}
                      formatFn={formatHours}
                    />
                    <VarianceRow
                      label="Labor Cost"
                      projected={jobDetails.summary?.projected_labor_cost}
                      actual={jobDetails.summary?.actual_labor_cost}
                      variance={jobDetails.summary?.labor_cost_variance}
                      variancePercent={jobDetails.summary?.labor_cost_variance_percent}
                    />
                    <VarianceRow
                      label="Labor Revenue"
                      projected={jobDetails.summary?.projected_labor_revenue}
                      actual={jobDetails.summary?.actual_labor_revenue}
                      variance={jobDetails.summary?.labor_revenue_variance}
                      variancePercent={0}
                      invertColors={true}
                    />
                    <VarianceRow
                      label="Material Cost"
                      projected={jobDetails.summary?.projected_material_cost}
                      actual={jobDetails.summary?.actual_material_cost}
                      variance={jobDetails.summary?.material_cost_variance}
                      variancePercent={jobDetails.summary?.material_cost_variance_percent}
                    />
                    <VarianceRow
                      label="Material Revenue"
                      projected={jobDetails.summary?.projected_material_revenue}
                      actual={jobDetails.summary?.actual_material_revenue}
                      variance={jobDetails.summary?.material_revenue_variance}
                      variancePercent={0}
                      invertColors={true}
                    />
                    <div className="variance-row total-row">
                      <div className="variance-label">Total Cost</div>
                      <div className="variance-projected">{formatCurrency(jobDetails.summary?.projected_total_cost)}</div>
                      <div className="variance-actual">{formatCurrency(jobDetails.summary?.actual_total_cost)}</div>
                      <div className={`variance-diff ${getVarianceClass(jobDetails.summary?.total_cost_variance)}`}>
                        {jobDetails.summary?.total_cost_variance > 0 ? '+' : ''}
                        {formatCurrency(jobDetails.summary?.total_cost_variance)}
                      </div>
                      <div className="variance-percent">-</div>
                    </div>
                  </div>
                </div>

                {/* Materials Section */}
                <div className="detail-section collapsible">
                  <h3 className="section-title">
                    <span className="section-icon">📦</span>
                    Materials Detail
                  </h3>
                  {jobDetails.materials && jobDetails.materials.length > 0 ? (
                    <div className="materials-detail-table">
                      <div className="detail-table-header">
                        <span>Item</span>
                        <span>Qty Needed</span>
                        <span>Qty Used</span>
                        <span>Variance</span>
                        <span>Status</span>
                      </div>
                      {jobDetails.materials.map((mat, idx) => (
                        <div key={idx} className="detail-table-row">
                          <span className="item-name">{mat.item_name}</span>
                          <span className="number-cell">{mat.quantity_needed}</span>
                          <span className="number-cell">{mat.quantity_used || 0}</span>
                          <span className={`number-cell ${getVarianceClass((mat.quantity_used || 0) - mat.quantity_needed)}`}>
                            {((mat.quantity_used || 0) - mat.quantity_needed) > 0 ? '+' : ''}
                            {(mat.quantity_used || 0) - mat.quantity_needed}
                          </span>
                          <span className={`status-badge status-${mat.status}`}>{mat.status}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No materials recorded for this job</p>
                  )}
                </div>

                {/* Labor Section */}
                <div className="detail-section collapsible">
                  <h3 className="section-title">
                    <span className="section-icon">👷</span>
                    Labor Detail
                  </h3>
                  {jobDetails.labor && jobDetails.labor.length > 0 ? (
                    <div className="labor-detail-table">
                      <div className="detail-table-header">
                        <span>Employee</span>
                        <span>Date</span>
                        <span>Hours</span>
                        <span>Pay Amount</span>
                        <span>Billable</span>
                      </div>
                      {jobDetails.labor.map((entry, idx) => (
                        <div key={idx} className="detail-table-row">
                          <span>{entry.employee_name}</span>
                          <span>{entry.work_date ? new Date(entry.work_date).toLocaleDateString() : '-'}</span>
                          <span className="number-cell">{parseFloat(entry.hours_worked || 0).toFixed(2)}</span>
                          <span className="number-cell">{formatCurrency(entry.pay_amount)}</span>
                          <span className="number-cell">{formatCurrency(entry.billable_amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No labor entries recorded for this job</p>
                  )}
                </div>

                {/* Schedule Section */}
                <div className="detail-section collapsible">
                  <h3 className="section-title">
                    <span className="section-icon">📅</span>
                    Schedule Dates
                  </h3>
                  {jobDetails.schedule && jobDetails.schedule.length > 0 ? (
                    <div className="schedule-detail-table">
                      <div className="detail-table-header">
                        <span>Date</span>
                        <span>Estimated Hours</span>
                        <span>Employee</span>
                      </div>
                      {jobDetails.schedule.map((entry, idx) => (
                        <div key={idx} className="detail-table-row">
                          <span>{new Date(entry.schedule_date).toLocaleDateString()}</span>
                          <span className="number-cell">{parseFloat(entry.estimated_hours || 0).toFixed(2)}</span>
                          <span>{entry.employee_name || '-'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No schedule dates recorded for this job</p>
                  )}
                </div>

                {/* Material Change History */}
                <div className="detail-section collapsible">
                  <h3 className="section-title">
                    <span className="section-icon">📜</span>
                    Material Change History
                  </h3>
                  {jobDetails.material_history && jobDetails.material_history.length > 0 ? (
                    <div className="history-detail-table">
                      <div className="detail-table-header">
                        <span>Date</span>
                        <span>Item</span>
                        <span>Change</span>
                        <span>Old → New</span>
                        <span>Changed By</span>
                      </div>
                      {jobDetails.material_history.map((entry, idx) => (
                        <div key={idx} className="detail-table-row">
                          <span>{new Date(entry.changed_at).toLocaleString()}</span>
                          <span className="item-name">{entry.item_name}</span>
                          <span className="change-type">{entry.change_type.replace(/_/g, ' ')}</span>
                          <span>
                            {entry.old_value || '-'} → {entry.new_value || '-'}
                          </span>
                          <span>{entry.changed_by}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No material change history recorded</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectedVsActualReport;
