import React, { useState } from 'react';
import './PeriodSelector.css';

const PeriodSelector = ({ value, onChange, showCustomDates = true }) => {
  const [period, setPeriod] = useState(value?.period || 'monthly');
  const [startDate, setStartDate] = useState(value?.startDate || '');
  const [endDate, setEndDate] = useState(value?.endDate || '');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const periods = [
    { value: 'daily', label: 'Today', icon: '📅' },
    { value: 'weekly', label: 'Week', icon: '📊' },
    { value: 'monthly', label: 'Month', icon: '📈' },
    { value: 'quarterly', label: 'Quarter', icon: '📉' },
    { value: 'annually', label: 'Year', icon: '🗓️' },
    { value: 'all-time', label: 'All Time', icon: '∞' },
  ];

  if (showCustomDates) {
    periods.push({ value: 'custom', label: 'Custom', icon: '⚙️' });
  }

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setShowDatePicker(newPeriod === 'custom');

    if (newPeriod !== 'custom') {
      // Auto-calculate date range for standard periods
      const today = new Date();
      let start = null;
      let end = today.toISOString().split('T')[0];

      switch (newPeriod) {
        case 'daily':
          start = end;
          break;
        case 'weekly':
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          start = weekAgo.toISOString().split('T')[0];
          break;
        case 'monthly':
          const monthAgo = new Date(today);
          monthAgo.setMonth(today.getMonth() - 1);
          start = monthAgo.toISOString().split('T')[0];
          break;
        case 'quarterly':
          const quarterAgo = new Date(today);
          quarterAgo.setMonth(today.getMonth() - 3);
          start = quarterAgo.toISOString().split('T')[0];
          break;
        case 'annually':
          const yearAgo = new Date(today);
          yearAgo.setFullYear(today.getFullYear() - 1);
          start = yearAgo.toISOString().split('T')[0];
          break;
        case 'all-time':
          start = null;
          end = null;
          break;
        default:
          break;
      }

      onChange({ period: newPeriod, startDate: start, endDate: end });
    }
  };

  const handleCustomDateChange = () => {
    if (startDate && endDate) {
      onChange({ period: 'custom', startDate, endDate });
    }
  };

  return (
    <div className="period-selector">
      <div className="period-pills">
        {periods.map((p) => (
          <button
            key={p.value}
            className={`period-pill ${period === p.value ? 'active' : ''}`}
            onClick={() => handlePeriodChange(p.value)}
            type="button"
          >
            <span className="period-icon">{p.icon}</span>
            <span className="period-label">{p.label}</span>
          </button>
        ))}
      </div>

      {showDatePicker && period === 'custom' && (
        <div className="custom-date-picker">
          <div className="date-input-group">
            <label htmlFor="start-date">Start Date</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate || undefined}
            />
          </div>
          <div className="date-input-group">
            <label htmlFor="end-date">End Date</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
            />
          </div>
          <button
            className="apply-dates-btn"
            onClick={handleCustomDateChange}
            disabled={!startDate || !endDate}
            type="button"
          >
            Apply Custom Range
          </button>
        </div>
      )}

      {period !== 'custom' && value?.startDate && value?.endDate && (
        <div className="date-range-display">
          {value.startDate} to {value.endDate}
        </div>
      )}
    </div>
  );
};

export default PeriodSelector;
