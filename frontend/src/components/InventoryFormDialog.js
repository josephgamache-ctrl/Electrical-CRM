import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  IconButton,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Grid,
  Switch,
  FormControlLabel,
  Autocomplete,
} from "@mui/material";
import {
  Close as CloseIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import { createInventoryItem, updateInventoryItem, fetchCategories, getVendors } from "../api";
import logger from '../utils/logger';
const TabPanel = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

const InventoryFormDialog = ({ open, onClose, item = null, mode = "add", onSuccess }) => {
  const isEditMode = mode === "edit" && item !== null;

  // Form state - all 77 fields
  const [formData, setFormData] = useState({
    // Identification
    item_id: "",
    sku: "",
    brand: "",
    upc: "",
    manufacturer_part_number: "",
    description: "",
    // Category
    category: "",
    subcategory: "",
    // Pricing
    cost: "",
    list_price: "",
    contractor_price: "",
    markup_percent: "35.00",
    sell_price: "",
    discount_price: "",
    // Inventory Management
    qty: "0",
    qty_allocated: "0",
    qty_on_order: "0",
    min_stock: "0",
    reorder_qty: "0",
    max_stock: "0",
    location: "",
    bin_location: "",
    last_counted_date: "",
    count_variance: "0",
    // Physical Properties
    qty_per: "Each",
    package_quantity: "",
    weight_lbs: "",
    length_inches: "",
    dimensions: "",
    // Electrical Specifications
    voltage: "",
    amperage: "",
    wire_gauge: "",
    wire_type: "",
    num_poles: "",
    phase: "",
    wire_insulation: "",
    wire_stranding: "",
    conduit_compatible: "",
    indoor_outdoor: "",
    wet_location_rated: false,
    // Compliance & Certifications
    ma_code_ref: "",
    nec_ref: "",
    ul_listed: false,
    certifications: "",
    arc_fault_required: false,
    gfci_required: false,
    tamper_resistant: false,
    // Supply Chain
    primary_vendor_id: "",
    alternate_vendor_id: "",
    vendor_part_number: "",
    lead_time_days: "0",
    last_order_date: "",
    last_order_cost: "",
    last_order_vendor_id: "",
    discontinued: false,
    replacement_item_id: "",
    // Media & Documentation
    image_url: "",
    datasheet_pdf: "",
    installation_guide: "",
    video_url: "",
    qr_code: "",
    // Usage & Analytics
    commonly_used: false,
    last_used_date: "",
    times_used: "0",
    usage_frequency: "",
    seasonal_item: false,
    // Business & Financial
    taxable: true,
    serialized: false,
    warranty_months: "0",
    returnable: true,
    // Metadata
    notes: "",
    estimation_guide: "",
    hazmat: false,
    active: true,
  });

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Load item data if editing
  useEffect(() => {
    if (isEditMode && item) {
      const newFormData = {};
      Object.keys(formData).forEach((key) => {
        if (item[key] !== undefined && item[key] !== null) {
          // Handle date fields
          if (key.includes("date") && item[key]) {
            newFormData[key] = item[key].split("T")[0];
          } else {
            newFormData[key] = item[key];
          }
        } else {
          newFormData[key] = formData[key];
        }
      });
      setFormData(newFormData);
    }
  }, [item, isEditMode]);

  // Load categories and vendors
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, vendorsData] = await Promise.all([
          fetchCategories(),
          getVendors(),
        ]);
        setCategories(categoriesData.categories || []);
        setVendors(vendorsData.vendors || []);
      } catch (err) {
        logger.error("Failed to load categories/vendors:", err);
      }
    };
    if (open) {
      loadData();
    }
  }, [open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const required = {
      item_id: "Item ID",
      brand: "Brand",
      description: "Description",
      category: "Category",
      cost: "Cost",
      sell_price: "Sell Price",
      qty: "Quantity",
      min_stock: "Min Stock",
      location: "Location",
    };

    for (const [field, label] of Object.entries(required)) {
      if (!formData[field] || formData[field] === "") {
        setError(`${label} is required`);
        return false;
      }
    }

    // Validate numeric fields
    if (parseFloat(formData.cost) < 0) {
      setError("Cost must be a positive number");
      return false;
    }
    if (parseFloat(formData.sell_price) < 0) {
      setError("Sell Price must be a positive number");
      return false;
    }
    if (parseInt(formData.qty) < 0) {
      setError("Quantity cannot be negative");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Prepare data - convert empty strings to null, parse numbers
      const submitData = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value === "" || value === null) {
          submitData[key] = null;
        } else if (
          [
            "cost",
            "list_price",
            "contractor_price",
            "markup_percent",
            "sell_price",
            "discount_price",
            "weight_lbs",
            "length_inches",
            "last_order_cost",
          ].includes(key)
        ) {
          submitData[key] = value ? parseFloat(value) : null;
        } else if (
          [
            "qty",
            "qty_allocated",
            "qty_on_order",
            "min_stock",
            "reorder_qty",
            "max_stock",
            "count_variance",
            "package_quantity",
            "num_poles",
            "lead_time_days",
            "times_used",
            "warranty_months",
            "primary_vendor_id",
            "alternate_vendor_id",
            "last_order_vendor_id",
          ].includes(key)
        ) {
          submitData[key] = value ? parseInt(value) : null;
        } else {
          submitData[key] = value;
        }
      });

      if (isEditMode) {
        await updateInventoryItem(item.id, submitData);
      } else {
        await createInventoryItem(submitData);
      }

      if (onSuccess) {
        onSuccess();
      }
      handleClose();
    } catch (err) {
      setError(err.message || `Failed to ${isEditMode ? "update" : "create"} item`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      item_id: "",
      sku: "",
      brand: "",
      upc: "",
      manufacturer_part_number: "",
      description: "",
      category: "",
      subcategory: "",
      cost: "",
      list_price: "",
      contractor_price: "",
      markup_percent: "35.00",
      sell_price: "",
      discount_price: "",
      qty: "0",
      qty_allocated: "0",
      qty_on_order: "0",
      min_stock: "0",
      reorder_qty: "0",
      max_stock: "0",
      location: "",
      bin_location: "",
      last_counted_date: "",
      count_variance: "0",
      qty_per: "Each",
      package_quantity: "",
      weight_lbs: "",
      length_inches: "",
      dimensions: "",
      voltage: "",
      amperage: "",
      wire_gauge: "",
      wire_type: "",
      num_poles: "",
      phase: "",
      wire_insulation: "",
      wire_stranding: "",
      conduit_compatible: "",
      indoor_outdoor: "",
      wet_location_rated: false,
      ma_code_ref: "",
      nec_ref: "",
      ul_listed: false,
      certifications: "",
      arc_fault_required: false,
      gfci_required: false,
      tamper_resistant: false,
      primary_vendor_id: "",
      alternate_vendor_id: "",
      vendor_part_number: "",
      lead_time_days: "0",
      last_order_date: "",
      last_order_cost: "",
      last_order_vendor_id: "",
      discontinued: false,
      replacement_item_id: "",
      image_url: "",
      datasheet_pdf: "",
      installation_guide: "",
      video_url: "",
      qr_code: "",
      commonly_used: false,
      last_used_date: "",
      times_used: "0",
      usage_frequency: "",
      seasonal_item: false,
      taxable: true,
      serialized: false,
      warranty_months: "0",
      returnable: true,
      notes: "",
      estimation_guide: "",
      hazmat: false,
      active: true,
    });
    setTabValue(0);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6">
            {isEditMode ? `Edit Item: ${item?.item_id}` : "Add New Item"}
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Basic Info" />
          <Tab label="Pricing" />
          <Tab label="Specs" />
          <Tab label="Vendor" />
          <Tab label="Advanced" />
        </Tabs>

        {/* Tab 0: Basic Info */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ px: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  label="Item ID"
                  value={formData.item_id}
                  onChange={(e) => handleChange("item_id", e.target.value)}
                  fullWidth
                  disabled={isEditMode}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="SKU"
                  value={formData.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  label="Brand"
                  value={formData.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="UPC/Barcode"
                  value={formData.upc}
                  onChange={(e) => handleChange("upc", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  required
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  freeSolo
                  options={categories}
                  value={formData.category}
                  onChange={(e, newValue) => handleChange("category", newValue || "")}
                  onInputChange={(e, newValue) => handleChange("category", newValue)}
                  renderInput={(params) => (
                    <TextField {...params} required label="Category" />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Subcategory"
                  value={formData.subcategory}
                  onChange={(e) => handleChange("subcategory", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  required
                  label="Quantity"
                  type="number"
                  value={formData.qty}
                  onChange={(e) => handleChange("qty", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  required
                  label="Min Stock"
                  type="number"
                  value={formData.min_stock}
                  onChange={(e) => handleChange("min_stock", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Reorder Qty"
                  type="number"
                  value={formData.reorder_qty}
                  onChange={(e) => handleChange("reorder_qty", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  label="Location"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  fullWidth
                  placeholder="e.g., Warehouse A, Shelf 3"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Bin Location"
                  value={formData.bin_location}
                  onChange={(e) => handleChange("bin_location", e.target.value)}
                  fullWidth
                  placeholder="e.g., A-3-2"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.commonly_used}
                      onChange={(e) => handleChange("commonly_used", e.target.checked)}
                    />
                  }
                  label="Commonly Used Item"
                />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Tab 1: Pricing */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ px: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  label="Cost"
                  type="number"
                  value={formData.cost}
                  onChange={(e) => handleChange("cost", e.target.value)}
                  fullWidth
                  InputProps={{ startAdornment: "$" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Markup %"
                  type="number"
                  value={formData.markup_percent}
                  onChange={(e) => handleChange("markup_percent", e.target.value)}
                  fullWidth
                  InputProps={{ endAdornment: "%" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  label="Sell Price"
                  type="number"
                  value={formData.sell_price}
                  onChange={(e) => handleChange("sell_price", e.target.value)}
                  fullWidth
                  InputProps={{ startAdornment: "$" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="List Price"
                  type="number"
                  value={formData.list_price}
                  onChange={(e) => handleChange("list_price", e.target.value)}
                  fullWidth
                  InputProps={{ startAdornment: "$" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Contractor Price"
                  type="number"
                  value={formData.contractor_price}
                  onChange={(e) => handleChange("contractor_price", e.target.value)}
                  fullWidth
                  InputProps={{ startAdornment: "$" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Discount Price"
                  type="number"
                  value={formData.discount_price}
                  onChange={(e) => handleChange("discount_price", e.target.value)}
                  fullWidth
                  InputProps={{ startAdornment: "$" }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.taxable}
                      onChange={(e) => handleChange("taxable", e.target.checked)}
                    />
                  }
                  label="Taxable"
                />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Tab 2: Electrical Specs */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ px: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Voltage"
                  value={formData.voltage}
                  onChange={(e) => handleChange("voltage", e.target.value)}
                  fullWidth
                  placeholder="e.g., 120V, 240V"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Amperage"
                  value={formData.amperage}
                  onChange={(e) => handleChange("amperage", e.target.value)}
                  fullWidth
                  placeholder="e.g., 15A, 20A"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Wire Gauge"
                  value={formData.wire_gauge}
                  onChange={(e) => handleChange("wire_gauge", e.target.value)}
                  fullWidth
                  placeholder="e.g., 12 AWG, 14 AWG"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Wire Type"
                  value={formData.wire_type}
                  onChange={(e) => handleChange("wire_type", e.target.value)}
                  fullWidth
                  placeholder="e.g., THHN, NM-B"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Number of Poles"
                  type="number"
                  value={formData.num_poles}
                  onChange={(e) => handleChange("num_poles", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phase"
                  value={formData.phase}
                  onChange={(e) => handleChange("phase", e.target.value)}
                  fullWidth
                  placeholder="e.g., Single, Three"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Wire Insulation"
                  value={formData.wire_insulation}
                  onChange={(e) => handleChange("wire_insulation", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Wire Stranding"
                  value={formData.wire_stranding}
                  onChange={(e) => handleChange("wire_stranding", e.target.value)}
                  fullWidth
                  placeholder="e.g., Solid, Stranded"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Indoor/Outdoor"
                  value={formData.indoor_outdoor}
                  onChange={(e) => handleChange("indoor_outdoor", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Conduit Compatible"
                  value={formData.conduit_compatible}
                  onChange={(e) => handleChange("conduit_compatible", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Certifications & Requirements
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.ul_listed}
                        onChange={(e) => handleChange("ul_listed", e.target.checked)}
                      />
                    }
                    label="UL Listed"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.wet_location_rated}
                        onChange={(e) => handleChange("wet_location_rated", e.target.checked)}
                      />
                    }
                    label="Wet Location Rated"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.arc_fault_required}
                        onChange={(e) => handleChange("arc_fault_required", e.target.checked)}
                      />
                    }
                    label="Arc Fault Required"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.gfci_required}
                        onChange={(e) => handleChange("gfci_required", e.target.checked)}
                      />
                    }
                    label="GFCI Required"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.tamper_resistant}
                        onChange={(e) => handleChange("tamper_resistant", e.target.checked)}
                      />
                    }
                    label="Tamper Resistant"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="MA Code Reference"
                  value={formData.ma_code_ref}
                  onChange={(e) => handleChange("ma_code_ref", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="NEC Reference"
                  value={formData.nec_ref}
                  onChange={(e) => handleChange("nec_ref", e.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* Tab 3: Vendor Info */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ px: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Primary Vendor</InputLabel>
                  <Select
                    value={formData.primary_vendor_id}
                    onChange={(e) => handleChange("primary_vendor_id", e.target.value)}
                    label="Primary Vendor"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {vendors.map((vendor) => (
                      <MenuItem key={vendor.id} value={vendor.id}>
                        {vendor.vendor_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Alternate Vendor</InputLabel>
                  <Select
                    value={formData.alternate_vendor_id}
                    onChange={(e) => handleChange("alternate_vendor_id", e.target.value)}
                    label="Alternate Vendor"
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {vendors.map((vendor) => (
                      <MenuItem key={vendor.id} value={vendor.id}>
                        {vendor.vendor_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Vendor Part Number"
                  value={formData.vendor_part_number}
                  onChange={(e) => handleChange("vendor_part_number", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Manufacturer Part Number"
                  value={formData.manufacturer_part_number}
                  onChange={(e) => handleChange("manufacturer_part_number", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Lead Time (days)"
                  type="number"
                  value={formData.lead_time_days}
                  onChange={(e) => handleChange("lead_time_days", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Order Cost"
                  type="number"
                  value={formData.last_order_cost}
                  onChange={(e) => handleChange("last_order_cost", e.target.value)}
                  fullWidth
                  InputProps={{ startAdornment: "$" }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Order Date"
                  type="date"
                  value={formData.last_order_date}
                  onChange={(e) => handleChange("last_order_date", e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.discontinued}
                      onChange={(e) => handleChange("discontinued", e.target.checked)}
                    />
                  }
                  label="Discontinued"
                />
              </Grid>
              {formData.discontinued && (
                <Grid item xs={12}>
                  <TextField
                    label="Replacement Item ID"
                    value={formData.replacement_item_id}
                    onChange={(e) => handleChange("replacement_item_id", e.target.value)}
                    fullWidth
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </TabPanel>

        {/* Tab 4: Advanced */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ px: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Physical Properties
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Unit of Measure"
                  value={formData.qty_per}
                  onChange={(e) => handleChange("qty_per", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Package Quantity"
                  type="number"
                  value={formData.package_quantity}
                  onChange={(e) => handleChange("package_quantity", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Weight (lbs)"
                  type="number"
                  value={formData.weight_lbs}
                  onChange={(e) => handleChange("weight_lbs", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Length (inches)"
                  type="number"
                  value={formData.length_inches}
                  onChange={(e) => handleChange("length_inches", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Dimensions"
                  value={formData.dimensions}
                  onChange={(e) => handleChange("dimensions", e.target.value)}
                  fullWidth
                  placeholder="e.g., 6x4x2 inches"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Media & Documentation
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Image URL"
                  value={formData.image_url}
                  onChange={(e) => handleChange("image_url", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Datasheet PDF URL"
                  value={formData.datasheet_pdf}
                  onChange={(e) => handleChange("datasheet_pdf", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Installation Guide URL"
                  value={formData.installation_guide}
                  onChange={(e) => handleChange("installation_guide", e.target.value)}
                  fullWidth
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Business Info
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Warranty (months)"
                  type="number"
                  value={formData.warranty_months}
                  onChange={(e) => handleChange("warranty_months", e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.serialized}
                        onChange={(e) => handleChange("serialized", e.target.checked)}
                      />
                    }
                    label="Serialized Item"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.returnable}
                        onChange={(e) => handleChange("returnable", e.target.checked)}
                      />
                    }
                    label="Returnable"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.hazmat}
                        onChange={(e) => handleChange("hazmat", e.target.checked)}
                      />
                    }
                    label="Hazardous Material"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.seasonal_item}
                        onChange={(e) => handleChange("seasonal_item", e.target.checked)}
                      />
                    }
                    label="Seasonal Item"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.active}
                        onChange={(e) => handleChange("active", e.target.checked)}
                      />
                    }
                    label="Active"
                  />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Estimation Guide"
                  value={formData.estimation_guide}
                  onChange={(e) => handleChange("estimation_guide", e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Guidelines for estimating quantity needed for jobs"
                />
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {loading ? "Saving..." : isEditMode ? "Update Item" : "Create Item"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InventoryFormDialog;
