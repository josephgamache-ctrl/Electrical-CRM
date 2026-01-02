import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PeriodSelector from './PeriodSelector';
import './JobProfitabilityReport.css';
import logger from '../../utils/logger';
const API_BASE = '/api';

const JobProfitabilityReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);

  const [period, setPeriod] = useState({
    period: 'monthly',
    startDate: null,
    endDate: null
  });

  const [jobType, setJobType] = useState('');

  const jobTypes = [
    { value: 'installation', label: 'Installation' },
    { value: 'repair', label: 'Repair' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'emergency', label: 'Emergency' }
  ];

  useEffect(() => {
    fetchReportData();
  }, [period, jobType]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const params = {
        period: period.period,
        start_date: period.startDate,
        end_date: period.endDate,
        status: 'completed' // Always filter to completed jobs only
      };

      // Add jobType filter if selected
      if (jobType) {
        params.jobType = jobType;
      }

      const response = await axios.get(`${API_BASE}/reports/profitability/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setReportData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load report data');
      logger.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobDetails = async (workOrderId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE}/reports/profitability/job/${workOrderId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setJobDetails(response.data);
      setSelectedJob(workOrderId);
    } catch (err) {
      logger.error('Job details fetch error:', err);
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

  const getMarginColor = (margin) => {
    if (margin >= 30) return '#28a745';
    if (margin >= 15) return '#ffc107';
    return '#dc3545';
  };

  if (loading && !reportData) {
    return (
      <div className="report-loading">
        <div className="loading-spinner"></div>
        <p>Loading profitability data...</p>
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
    <div className="job-profitability-report">
      <div className="report-header">
        <h1>
          <span className="report-icon">💰</span>
          Job Profitability Report
        </h1>
        <p className="report-subtitle">
          Comprehensive analysis of revenue, costs, and margins
        </p>
      </div>

      <div className="report-controls">
        <PeriodSelector value={period} onChange={setPeriod} />

        <div className="job-type-filter">
          <label htmlFor="jobType" className="filter-label">
            <span className="filter-icon">🔧</span>
            Job Type
          </label>
          <select
            id="jobType"
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="filter-select"
          >
            <option value="">All Job Types</option>
            {jobTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {reportData && (
        <>
          <div className="summary-cards">
            <div className="summary-card primary">
              <div className="card-icon">📊</div>
              <div className="card-content">
                <div className="card-label">Total Jobs</div>
                <div className="card-value">{reportData.summary.total_jobs}</div>
              </div>
            </div>

            <div className="summary-card success">
              <div className="card-icon">💵</div>
              <div className="card-content">
                <div className="card-label">Total Revenue</div>
                <div className="card-value">{formatCurrency(reportData.summary.total_revenue)}</div>
              </div>
            </div>

            <div className="summary-card warning">
              <div className="card-icon">💸</div>
              <div className="card-content">
                <div className="card-label">Total Costs</div>
                <div className="card-value">{formatCurrency(reportData.summary.total_costs)}</div>
              </div>
            </div>

            <div className="summary-card profit">
              <div className="card-icon">📈</div>
              <div className="card-content">
                <div className="card-label">Gross Profit</div>
                <div className="card-value">{formatCurrency(reportData.summary.gross_profit)}</div>
                <div className="card-subtitle">
                  {((reportData.summary.gross_profit / reportData.summary.total_revenue) * 100).toFixed(1)}% margin
                </div>
              </div>
            </div>

            <div className="summary-card info">
              <div className="card-icon">⏱️</div>
              <div className="card-content">
                <div className="card-label">Total Hours</div>
                <div className="card-value">{formatHours(reportData.summary.total_hours)}</div>
              </div>
            </div>
          </div>

          <div className="jobs-list">
            <div className="jobs-list-header">
              <h2>Jobs Breakdown</h2>
              <div className="jobs-count">{reportData.jobs.length} jobs</div>
            </div>

            <div className="jobs-grid">
              {reportData.jobs.map((job) => {
                const margin = job.total_revenue > 0
                  ? ((job.gross_profit / job.total_revenue) * 100)
                  : 0;

                return (
                  <div
                    key={job.work_order_id}
                    className="job-card"
                    onClick={() => fetchJobDetails(job.work_order_id)}
                  >
                    <div className="job-card-header">
                      <div className="job-number">{job.work_order_number}</div>
                      <div className={`job-status status-${job.status}`}>
                        {job.status}
                      </div>
                    </div>

                    <div className="job-customer">
                      <span className="customer-icon">🏢</span>
                      {job.customer_name}
                    </div>

                    {job.company_name && (
                      <div className="job-company">{job.company_name}</div>
                    )}

                    <div className="job-metrics">
                      <div className="metric">
                        <div className="metric-label">Revenue</div>
                        <div className="metric-value">{formatCurrency(job.total_revenue)}</div>
                      </div>
                      <div className="metric">
                        <div className="metric-label">Costs</div>
                        <div className="metric-value">{formatCurrency(job.total_costs)}</div>
                      </div>
                      <div className="metric">
                        <div className="metric-label">Profit</div>
                        <div className="metric-value profit">{formatCurrency(job.gross_profit)}</div>
                      </div>
                    </div>

                    <div className="job-margin">
                      <div
                        className="margin-bar"
                        style={{
                          width: `${Math.min(margin, 100)}%`,
                          background: getMarginColor(margin)
                        }}
                      ></div>
                      <div className="margin-label" style={{ color: getMarginColor(margin) }}>
                        {margin.toFixed(1)}% margin
                      </div>
                    </div>

                    <div className="job-hours">
                      <span className="hours-icon">⏱️</span>
                      {formatHours(job.total_hours_worked)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {selectedJob && jobDetails && (
        <div className="job-details-modal" onClick={() => setSelectedJob(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{jobDetails.profitability.work_order_number}</h2>
              <button className="modal-close" onClick={() => setSelectedJob(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="details-section">
                <h3>📦 Materials</h3>
                {jobDetails.materials.length > 0 ? (
                  <div className="materials-table">
                    {jobDetails.materials.map((material, idx) => (
                      <div key={idx} className="material-row">
                        <div className="material-name">{material.item_name}</div>
                        <div className="material-qty">Qty: {material.quantity_used}</div>
                        <div className="material-cost">{formatCurrency(material.line_cost)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No materials recorded</p>
                )}
              </div>

              <div className="details-section">
                <h3>👷 Labor</h3>
                {jobDetails.labor.length > 0 ? (
                  <div className="labor-table">
                    {jobDetails.labor.map((entry, idx) => (
                      <div key={idx} className="labor-row">
                        <div className="labor-employee">{entry.employee_name}</div>
                        <div className="labor-hours">{formatHours(entry.hours_worked)}</div>
                        <div className="labor-cost">{formatCurrency(entry.pay_amount)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No labor recorded</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobProfitabilityReport;
