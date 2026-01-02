import React, { useState, useEffect } from 'react';
import { getProfitLossReport, getProfitLossComparison, getJobProfitabilityDetail } from '../../api';
import PeriodSelector from './PeriodSelector';
import logger from '../../utils/logger';
import './ProfitLossReport.css';

const ProfitLossReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [view, setView] = useState('summary'); // 'summary' or 'itemized'
  const [groupBy, setGroupBy] = useState('job'); // 'job', 'customer', 'job_type', 'month'
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);

  // Job detail modal state
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDetails, setJobDetails] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);

  const [period, setPeriod] = useState({
    period: 'monthly',
    startDate: null,
    endDate: null
  });

  // Comparison periods
  const [comparisonPeriod1, setComparisonPeriod1] = useState({
    startDate: '',
    endDate: ''
  });
  const [comparisonPeriod2, setComparisonPeriod2] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchReportData();
  }, [period, view, groupBy]);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getProfitLossReport({
        period: period.period,
        startDate: period.startDate,
        endDate: period.endDate,
        view: view,
        groupBy: view === 'itemized' ? groupBy : null
      });

      setReportData(response);
    } catch (err) {
      setError(err.message || 'Failed to load P&L report');
    } finally {
      setLoading(false);
    }
  };

  const fetchComparisonData = async () => {
    if (!comparisonPeriod1.startDate || !comparisonPeriod1.endDate ||
        !comparisonPeriod2.startDate || !comparisonPeriod2.endDate) {
      setError('Please select both comparison periods');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getProfitLossComparison(
        comparisonPeriod1.startDate,
        comparisonPeriod1.endDate,
        comparisonPeriod2.startDate,
        comparisonPeriod2.endDate
      );

      setComparisonData(response);
    } catch (err) {
      setError(err.message || 'Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  const formatPercentChange = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value || 0).toFixed(1)}%`;
  };

  const fetchJobDetails = async (workOrderId) => {
    setLoadingJob(true);
    try {
      const details = await getJobProfitabilityDetail(workOrderId);
      setJobDetails(details);
      setSelectedJob(workOrderId);
    } catch (err) {
      logger.error('Failed to load job details:', err);
    } finally {
      setLoadingJob(false);
    }
  };

  const closeJobModal = () => {
    setSelectedJob(null);
    setJobDetails(null);
  };

  if (loading && !reportData) {
    return (
      <div className="report-loading">
        <div className="loading-spinner"></div>
        <p>Loading P&L Report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="report-error">
        <span className="error-icon">!</span>
        <h3>Error Loading Report</h3>
        <p>{error}</p>
        <button onClick={fetchReportData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="profit-loss-report">
      <div className="report-header">
        <h1>
          <span className="report-icon">$</span>
          Profit & Loss Report
        </h1>
        <p className="report-subtitle">
          Financial overview for your accountant - Revenue, costs, and profitability
        </p>
      </div>

      {/* View Toggle */}
      <div className="view-toggle-container">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${view === 'summary' ? 'active' : ''}`}
            onClick={() => setView('summary')}
          >
            Summary View
          </button>
          <button
            className={`toggle-btn ${view === 'itemized' ? 'active' : ''}`}
            onClick={() => setView('itemized')}
          >
            Itemized View
          </button>
        </div>
        <div className="comparison-toggle">
          <label>
            <input
              type="checkbox"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
            />
            Compare Periods
          </label>
        </div>
      </div>

      {/* Controls */}
      {!showComparison ? (
        <div className="report-controls">
          <PeriodSelector value={period} onChange={setPeriod} />

          {view === 'itemized' && (
            <div className="group-by-filter">
              <label htmlFor="groupBy" className="filter-label">
                Group By
              </label>
              <select
                id="groupBy"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="filter-select"
              >
                <option value="job">By Job</option>
                <option value="customer">By Customer</option>
                <option value="job_type">By Job Type</option>
                <option value="month">By Month</option>
                <option value="employee">By Employee (Payroll)</option>
                <option value="material_category">By Material Category</option>
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="comparison-controls">
          <div className="comparison-period">
            <h4>Period 1</h4>
            <div className="date-inputs">
              <input
                type="date"
                value={comparisonPeriod1.startDate}
                onChange={(e) => setComparisonPeriod1({...comparisonPeriod1, startDate: e.target.value})}
              />
              <span>to</span>
              <input
                type="date"
                value={comparisonPeriod1.endDate}
                onChange={(e) => setComparisonPeriod1({...comparisonPeriod1, endDate: e.target.value})}
              />
            </div>
          </div>
          <div className="comparison-period">
            <h4>Period 2</h4>
            <div className="date-inputs">
              <input
                type="date"
                value={comparisonPeriod2.startDate}
                onChange={(e) => setComparisonPeriod2({...comparisonPeriod2, startDate: e.target.value})}
              />
              <span>to</span>
              <input
                type="date"
                value={comparisonPeriod2.endDate}
                onChange={(e) => setComparisonPeriod2({...comparisonPeriod2, endDate: e.target.value})}
              />
            </div>
          </div>
          <button className="compare-btn" onClick={fetchComparisonData}>
            Compare Periods
          </button>
        </div>
      )}

      {/* Summary View */}
      {reportData && !showComparison && (
        <>
          {/* Summary Cards */}
          <div className="pl-summary-section">
            <h2 className="section-title">Financial Summary</h2>
            <div className="summary-cards">
              <div className="summary-card revenue">
                <div className="card-icon">R</div>
                <div className="card-content">
                  <div className="card-label">Total Revenue</div>
                  <div className="card-value">{formatCurrency(reportData.summary.revenue.total)}</div>
                  <div className="card-breakdown">
                    <span>Labor: {formatCurrency(reportData.summary.revenue.labor)}</span>
                    <span>Materials: {formatCurrency(reportData.summary.revenue.materials)}</span>
                  </div>
                </div>
              </div>

              <div className="summary-card costs">
                <div className="card-icon">C</div>
                <div className="card-content">
                  <div className="card-label">Cost of Goods Sold</div>
                  <div className="card-value">{formatCurrency(reportData.summary.cost_of_goods_sold.total)}</div>
                  <div className="card-breakdown">
                    <span>Labor: {formatCurrency(reportData.summary.cost_of_goods_sold.labor)}</span>
                    <span>Materials: {formatCurrency(reportData.summary.cost_of_goods_sold.materials)}</span>
                  </div>
                </div>
              </div>

              <div className="summary-card profit">
                <div className="card-icon">P</div>
                <div className="card-content">
                  <div className="card-label">Gross Profit</div>
                  <div className="card-value">{formatCurrency(reportData.summary.gross_profit)}</div>
                  <div className="card-subtitle margin">
                    {formatPercent(reportData.summary.gross_margin_percent)} Margin
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Jobs Summary */}
          <div className="pl-summary-section">
            <h2 className="section-title">Jobs Overview</h2>
            <div className="summary-cards small">
              <div className="summary-card info">
                <div className="card-content">
                  <div className="card-label">Total Jobs</div>
                  <div className="card-value">{reportData.summary.job_counts.total}</div>
                </div>
              </div>
              <div className="summary-card success">
                <div className="card-content">
                  <div className="card-label">Completed</div>
                  <div className="card-value">{reportData.summary.job_counts.completed}</div>
                </div>
              </div>
              <div className="summary-card warning">
                <div className="card-content">
                  <div className="card-label">Active</div>
                  <div className="card-value">{reportData.summary.job_counts.active}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Collections Summary */}
          <div className="pl-summary-section">
            <h2 className="section-title">Collections</h2>
            <div className="summary-cards small">
              <div className="summary-card info">
                <div className="card-content">
                  <div className="card-label">Invoiced</div>
                  <div className="card-value">{formatCurrency(reportData.summary.collections.invoiced)}</div>
                </div>
              </div>
              <div className="summary-card success">
                <div className="card-content">
                  <div className="card-label">Collected</div>
                  <div className="card-value">{formatCurrency(reportData.summary.collections.collected)}</div>
                </div>
              </div>
              <div className="summary-card warning">
                <div className="card-content">
                  <div className="card-label">Outstanding</div>
                  <div className="card-value">{formatCurrency(reportData.summary.collections.outstanding)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Inventory Value */}
          <div className="pl-summary-section">
            <h2 className="section-title">Inventory</h2>
            <div className="summary-cards small">
              <div className="summary-card info inventory">
                <div className="card-content">
                  <div className="card-label">Current Inventory Value</div>
                  <div className="card-value">{formatCurrency(reportData.summary.inventory_value)}</div>
                  <div className="card-breakdown">
                    <span>On-hand stock at cost</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Breakdown */}
          {view === 'itemized' && reportData.items && reportData.items.length > 0 && (
            <div className="pl-itemized-section">
              <h2 className="section-title">
                Itemized Breakdown (by {groupBy.replace('_', ' ')})
              </h2>
              <div className="itemized-table-wrapper">
                {/* Employee View */}
                {groupBy === 'employee' ? (
                  <table className="itemized-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Role</th>
                        <th className="right">Hours</th>
                        <th className="right">Jobs</th>
                        <th className="right">Pay Rate</th>
                        <th className="right">Labor Cost</th>
                        <th className="right">Labor Revenue</th>
                        <th className="right">Profit</th>
                        <th className="right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="primary-cell">{item.employee_name}</td>
                          <td>{item.employee_role || 'N/A'}</td>
                          <td className="right">{(item.total_hours || 0).toFixed(2)}</td>
                          <td className="right">{item.job_count || 0}</td>
                          <td className="right">{formatCurrency(item.avg_pay_rate)}</td>
                          <td className="right">{formatCurrency(item.labor_cost)}</td>
                          <td className="right">{formatCurrency(item.labor_revenue)}</td>
                          <td className="right profit-cell">{formatCurrency(item.profit)}</td>
                          <td className="right">
                            <span className={`margin-badge ${item.margin_percent >= 30 ? 'good' : item.margin_percent >= 15 ? 'warning' : 'low'}`}>
                              {formatPercent(item.margin_percent)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="totals-row">
                        <td colSpan="5"><strong>TOTAL</strong></td>
                        <td className="right"><strong>{formatCurrency(reportData.items.reduce((sum, i) => sum + (i.labor_cost || 0), 0))}</strong></td>
                        <td className="right"><strong>{formatCurrency(reportData.items.reduce((sum, i) => sum + (i.labor_revenue || 0), 0))}</strong></td>
                        <td className="right profit-cell"><strong>{formatCurrency(reportData.items.reduce((sum, i) => sum + (i.profit || 0), 0))}</strong></td>
                        <td className="right">-</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : groupBy === 'material_category' ? (
                  /* Material Category View */
                  <table className="itemized-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className="right">Items</th>
                        <th className="right">Qty Used</th>
                        <th className="right">Jobs</th>
                        <th className="right">Cost</th>
                        <th className="right">Revenue</th>
                        <th className="right">Profit</th>
                        <th className="right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="primary-cell">{item.category}</td>
                          <td className="right">{item.unique_items || 0}</td>
                          <td className="right">{item.total_quantity || 0}</td>
                          <td className="right">{item.job_count || 0}</td>
                          <td className="right">{formatCurrency(item.material_cost)}</td>
                          <td className="right">{formatCurrency(item.material_revenue)}</td>
                          <td className="right profit-cell">{formatCurrency(item.profit)}</td>
                          <td className="right">
                            <span className={`margin-badge ${item.margin_percent >= 30 ? 'good' : item.margin_percent >= 15 ? 'warning' : 'low'}`}>
                              {formatPercent(item.margin_percent)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="totals-row">
                        <td colSpan="4"><strong>TOTAL</strong></td>
                        <td className="right"><strong>{formatCurrency(reportData.items.reduce((sum, i) => sum + (i.material_cost || 0), 0))}</strong></td>
                        <td className="right"><strong>{formatCurrency(reportData.items.reduce((sum, i) => sum + (i.material_revenue || 0), 0))}</strong></td>
                        <td className="right profit-cell"><strong>{formatCurrency(reportData.items.reduce((sum, i) => sum + (i.profit || 0), 0))}</strong></td>
                        <td className="right">-</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  /* Standard View (Job, Customer, Job Type, Month) */
                  <table className="itemized-table">
                    <thead>
                      <tr>
                        <th>{groupBy === 'job' ? 'Job #' : groupBy === 'customer' ? 'Customer' : groupBy === 'job_type' ? 'Type' : 'Month'}</th>
                        {groupBy === 'job' && <th>Customer</th>}
                        <th className="right">Revenue</th>
                        <th className="right">COGS</th>
                        <th className="right">Gross Profit</th>
                        <th className="right">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.items.map((item, idx) => {
                        const revenue = item.total_revenue || item.revenue || 0;
                        const costs = (item.material_cost || 0) + (item.labor_cost || 0) || item.costs || 0;
                        const profit = item.profit || item.gross_profit || 0;
                        const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
                        const isClickable = groupBy === 'job' && item.work_order_id;

                        return (
                          <tr
                            key={idx}
                            className={isClickable ? 'clickable-row' : ''}
                            onClick={isClickable ? () => fetchJobDetails(item.work_order_id) : undefined}
                            title={isClickable ? 'Click to view details' : undefined}
                          >
                            <td className="primary-cell">
                              {item.work_order_number || item.customer_name || item.job_type || item.month_label || item.month}
                              {isClickable && <span className="click-hint"> (click for details)</span>}
                            </td>
                            {groupBy === 'job' && <td>{item.customer_name}</td>}
                            <td className="right">{formatCurrency(revenue)}</td>
                            <td className="right">{formatCurrency(costs)}</td>
                            <td className="right profit-cell">{formatCurrency(profit)}</td>
                            <td className="right">
                              <span className={`margin-badge ${marginPct >= 30 ? 'good' : marginPct >= 15 ? 'warning' : 'low'}`}>
                                {formatPercent(item.margin_percent || marginPct)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="totals-row">
                        <td><strong>TOTAL</strong></td>
                        {groupBy === 'job' && <td></td>}
                        <td className="right"><strong>{formatCurrency(reportData.summary.revenue.total)}</strong></td>
                        <td className="right"><strong>{formatCurrency(reportData.summary.cost_of_goods_sold.total)}</strong></td>
                        <td className="right profit-cell"><strong>{formatCurrency(reportData.summary.gross_profit)}</strong></td>
                        <td className="right">
                          <span className={`margin-badge ${reportData.summary.gross_margin_percent >= 30 ? 'good' : reportData.summary.gross_margin_percent >= 15 ? 'warning' : 'low'}`}>
                            <strong>{formatPercent(reportData.summary.gross_margin_percent)}</strong>
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Period Info */}
          <div className="period-info">
            <span className="period-label">Report Period:</span>
            <span className="period-dates">
              {reportData.start_date || 'All Time'} to {reportData.end_date || 'Present'}
            </span>
          </div>
        </>
      )}

      {/* Comparison View */}
      {showComparison && comparisonData && (
        <div className="comparison-results">
          <h2 className="section-title">Period Comparison</h2>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="right">Period 1</th>
                  <th className="right">Period 2</th>
                  <th className="right">% Change</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Revenue</td>
                  <td className="right">{formatCurrency(comparisonData.period1.revenue)}</td>
                  <td className="right">{formatCurrency(comparisonData.period2.revenue)}</td>
                  <td className={`right ${comparisonData.change.revenue >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercentChange(comparisonData.change.revenue)}
                  </td>
                </tr>
                <tr>
                  <td>Cost of Goods Sold</td>
                  <td className="right">{formatCurrency(comparisonData.period1.costs)}</td>
                  <td className="right">{formatCurrency(comparisonData.period2.costs)}</td>
                  <td className={`right ${comparisonData.change.costs <= 0 ? 'positive' : 'negative'}`}>
                    {formatPercentChange(comparisonData.change.costs)}
                  </td>
                </tr>
                <tr className="highlight-row">
                  <td><strong>Gross Profit</strong></td>
                  <td className="right"><strong>{formatCurrency(comparisonData.period1.profit)}</strong></td>
                  <td className="right"><strong>{formatCurrency(comparisonData.period2.profit)}</strong></td>
                  <td className={`right ${comparisonData.change.profit >= 0 ? 'positive' : 'negative'}`}>
                    <strong>{formatPercentChange(comparisonData.change.profit)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Gross Margin %</td>
                  <td className="right">{comparisonData.period1.revenue > 0 ? formatPercent((comparisonData.period1.profit / comparisonData.period1.revenue) * 100) : '0.0%'}</td>
                  <td className="right">{comparisonData.period2.revenue > 0 ? formatPercent((comparisonData.period2.profit / comparisonData.period2.revenue) * 100) : '0.0%'}</td>
                  <td className="right">-</td>
                </tr>
                <tr>
                  <td>Jobs Completed</td>
                  <td className="right">{comparisonData.period1.jobs}</td>
                  <td className="right">{comparisonData.period2.jobs}</td>
                  <td className={`right ${comparisonData.change.jobs >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercentChange(comparisonData.change.jobs)}
                  </td>
                </tr>
                <tr>
                  <td>Total Hours</td>
                  <td className="right">{comparisonData.period1.hours.toFixed(1)}</td>
                  <td className="right">{comparisonData.period2.hours.toFixed(1)}</td>
                  <td className={`right ${comparisonData.change.hours >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercentChange(comparisonData.change.hours)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="comparison-period-info">
            <div className="period-box">
              <strong>Period 1:</strong> {comparisonData.period1.start} to {comparisonData.period1.end}
            </div>
            <div className="period-box">
              <strong>Period 2:</strong> {comparisonData.period2.start} to {comparisonData.period2.end}
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="job-details-modal" onClick={closeJobModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {jobDetails?.profitability?.work_order_number || `Job #${selectedJob}`}
                {jobDetails?.profitability?.customer_name && (
                  <span className="modal-customer"> - {jobDetails.profitability.customer_name}</span>
                )}
              </h2>
              <button className="modal-close" onClick={closeJobModal}>X</button>
            </div>

            {loadingJob ? (
              <div className="modal-loading">
                <div className="loading-spinner"></div>
                <p>Loading job details...</p>
              </div>
            ) : jobDetails ? (
              <div className="modal-body">
                {/* Job Summary */}
                <div className="job-summary-section">
                  <h3>Financial Summary</h3>
                  <div className="job-summary-grid">
                    <div className="summary-item revenue">
                      <span className="label">Total Revenue</span>
                      <span className="value">{formatCurrency(jobDetails.profitability?.total_revenue)}</span>
                    </div>
                    <div className="summary-item costs">
                      <span className="label">Total Costs</span>
                      <span className="value">{formatCurrency(jobDetails.profitability?.total_costs)}</span>
                    </div>
                    <div className="summary-item profit">
                      <span className="label">Gross Profit</span>
                      <span className="value">{formatCurrency(jobDetails.profitability?.gross_profit)}</span>
                    </div>
                    <div className="summary-item margin">
                      <span className="label">Profit Margin</span>
                      <span className="value">{formatPercent(jobDetails.profitability?.profit_margin_percent)}</span>
                    </div>
                  </div>
                </div>

                {/* Materials Section */}
                <div className="details-section">
                  <h3>Materials</h3>
                  <div className="materials-summary">
                    <div className="summary-row">
                      <span>Material Cost:</span>
                      <span className="cost">{formatCurrency(jobDetails.profitability?.total_material_cost)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Material Revenue:</span>
                      <span className="revenue">{formatCurrency(jobDetails.profitability?.total_material_revenue)}</span>
                    </div>
                    <div className="summary-row profit-row">
                      <span>Material Profit:</span>
                      <span className="profit">{formatCurrency(jobDetails.profitability?.material_profit)}</span>
                    </div>
                  </div>
                  {jobDetails.materials && jobDetails.materials.length > 0 ? (
                    <table className="details-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th className="right">Qty</th>
                          <th className="right">Unit Cost</th>
                          <th className="right">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobDetails.materials.map((mat, idx) => (
                          <tr key={idx}>
                            <td>{mat.item_name}</td>
                            <td className="right">{mat.quantity_used}</td>
                            <td className="right">{formatCurrency(mat.unit_cost)}</td>
                            <td className="right">{formatCurrency(mat.line_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No materials recorded for this job</p>
                  )}
                </div>

                {/* Labor Section */}
                <div className="details-section">
                  <h3>Labor</h3>
                  <div className="labor-summary">
                    <div className="summary-row">
                      <span>Labor Cost:</span>
                      <span className="cost">{formatCurrency(jobDetails.profitability?.total_labor_cost)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Labor Revenue:</span>
                      <span className="revenue">{formatCurrency(jobDetails.profitability?.total_labor_revenue)}</span>
                    </div>
                    <div className="summary-row profit-row">
                      <span>Labor Profit:</span>
                      <span className="profit">{formatCurrency(jobDetails.profitability?.labor_profit)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Total Hours:</span>
                      <span>{(jobDetails.profitability?.total_hours_worked || 0).toFixed(2)} hrs</span>
                    </div>
                  </div>
                  {jobDetails.labor && jobDetails.labor.length > 0 ? (
                    <table className="details-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th className="right">Hours</th>
                          <th className="right">Pay Rate</th>
                          <th className="right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobDetails.labor.map((lab, idx) => (
                          <tr key={idx}>
                            <td>{lab.employee_name}</td>
                            <td className="right">{(lab.hours_worked || 0).toFixed(2)}</td>
                            <td className="right">{formatCurrency(lab.pay_rate)}</td>
                            <td className="right">{formatCurrency(lab.pay_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="no-data">No labor recorded for this job</p>
                  )}
                </div>

                {/* Job Info */}
                <div className="details-section job-info">
                  <h3>Job Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">Job Type:</span>
                      <span className="value">{jobDetails.profitability?.job_type || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Status:</span>
                      <span className="value">{jobDetails.profitability?.status || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Quoted Price:</span>
                      <span className="value">{formatCurrency(jobDetails.profitability?.quoted_price)}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Final Price:</span>
                      <span className="value">{formatCurrency(jobDetails.profitability?.final_price)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="modal-error">
                <p>Failed to load job details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print/Export Notice */}
      <div className="export-notice">
        <p>Use your browser's print function (Ctrl+P / Cmd+P) to save this report as PDF</p>
      </div>
    </div>
  );
};

export default ProfitLossReport;
