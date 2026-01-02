import React, { useState, useEffect } from 'react';
import './ReportFilters.css';

const ReportFilters = ({
  availableFilters = {},
  onFilterChange,
  onClear
}) => {
  const [filters, setFilters] = useState({
    employee: '',
    customer: '',
    jobType: '',
    status: ''
  });

  const [expandedSections, setExpandedSections] = useState({
    employee: false,
    customer: false,
    jobType: false,
    status: false
  });

  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    const count = Object.values(filters).filter(v => v !== '').length;
    setActiveFiltersCount(count);
  }, [filters]);

  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...filters, [filterName]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleClear = () => {
    const clearedFilters = {
      employee: '',
      customer: '',
      jobType: '',
      status: ''
    };
    setFilters(clearedFilters);
    onClear();
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const filterSections = [
    {
      key: 'employee',
      label: 'Employee',
      icon: '👤',
      type: 'select',
      options: availableFilters.employees || [],
      valueKey: 'username',
      labelKey: 'full_name'
    },
    {
      key: 'customer',
      label: 'Customer',
      icon: '🏢',
      type: 'select',
      options: availableFilters.customers || [],
      valueKey: 'id',
      labelKey: 'display_name'
    },
    {
      key: 'jobType',
      label: 'Job Type',
      icon: '🔧',
      type: 'select',
      options: availableFilters.jobTypes || [],
      valueKey: 'value',
      labelKey: 'label'
    },
    {
      key: 'status',
      label: 'Status',
      icon: '📋',
      type: 'select',
      options: availableFilters.statuses || [],
      valueKey: 'value',
      labelKey: 'label'
    }
  ];

  return (
    <div className="report-filters">
      <div className="filters-header">
        <div className="filters-title">
          <span className="filters-icon">🔍</span>
          <h3>Filters</h3>
          {activeFiltersCount > 0 && (
            <span className="filter-badge">{activeFiltersCount}</span>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <button
            className="clear-filters-btn"
            onClick={handleClear}
            type="button"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="filter-sections">
        {filterSections.map((section) => (
          <details
            key={section.key}
            className="filter-section"
            open={expandedSections[section.key]}
          >
            <summary
              className="filter-section-header"
              onClick={(e) => {
                e.preventDefault();
                toggleSection(section.key);
              }}
            >
              <div className="filter-section-title">
                <span className="filter-section-icon">{section.icon}</span>
                <span className="filter-section-label">{section.label}</span>
                {filters[section.key] && (
                  <span className="filter-active-indicator">●</span>
                )}
              </div>
              <span className={`filter-chevron ${expandedSections[section.key] ? 'expanded' : ''}`}>
                ▼
              </span>
            </summary>

            <div className="filter-section-content">
              {section.type === 'select' && (
                <div className="filter-select-wrapper">
                  <select
                    value={filters[section.key]}
                    onChange={(e) => handleFilterChange(section.key, e.target.value)}
                    className="filter-select"
                  >
                    <option value="">All {section.label}s</option>
                    {section.options.map((option) => (
                      <option
                        key={option[section.valueKey]}
                        value={option[section.valueKey]}
                      >
                        {option[section.labelKey]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>

      {activeFiltersCount > 0 && (
        <div className="active-filters-summary">
          <div className="active-filters-label">Active Filters:</div>
          <div className="active-filter-chips">
            {Object.entries(filters).map(([key, value]) => {
              if (!value) return null;
              const section = filterSections.find(s => s.key === key);
              const option = section?.options.find(o => String(o[section.valueKey]) === String(value));
              return (
                <div key={key} className="filter-chip">
                  <span className="filter-chip-icon">{section?.icon}</span>
                  <span className="filter-chip-text">
                    {option?.[section.labelKey] || value}
                  </span>
                  <button
                    className="filter-chip-remove"
                    onClick={() => handleFilterChange(key, '')}
                    type="button"
                    aria-label={`Remove ${section?.label} filter`}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportFilters;
