import React, { useState, useEffect, useCallback } from "react";
import { Grid, Button, IconButton, Tooltip, Collapse } from "@mui/material";
import {
  Save as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import { useForm, useWatch } from "react-hook-form";
import { debounce } from "lodash";
import CippButtonCard from "/src/components/CippCards/CippButtonCard";
import CippFormComponent from "/src/components/CippComponents/CippFormComponent";
import { ApiGetCall, ApiPostCall } from "../../api/ApiCall";
import { useSettings } from "../../hooks/use-settings";
import { CippApiResults } from "../CippComponents/CippApiResults";
import { CippFormCondition } from "../CippComponents/CippFormCondition";
import { CippOffCanvas } from "../CippComponents/CippOffCanvas";
import { CippCodeBlock } from "../CippComponents/CippCodeBlock";

const CippGraphExplorerFilter = ({ onSubmitFilter }) => {
  const [offCanvasOpen, setOffCanvasOpen] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(true);
  const [offCanvasContent, setOffCanvasContent] = useState(null);
  const formControl = useForm({
    mode: "onChange",
    defaultValues: {
      endpoint: "",
      $select: "",
      NoPagination: false,
      ReverseTenantLookup: false,
      ReverseTenantLookupProperty: "tenantId",
      $count: false,
      manualPagination: false,
    },
  });

  const { control, handleSubmit, watch } = formControl;
  const tenant = useSettings().currentTenant;
  const endPoint = useWatch({ control, name: "endpoint" });

  // API call for available properties
  const propertyList = ApiGetCall({
    url: "/api/ListGraphRequest",
    queryKey: `graph-properties-${endPoint}`,
    data: {
      Endpoint: endPoint,
      ListProperties: true,
      TenantFilter: tenant,
      IgnoreErrors: true,
    },
    waiting: false,
  });

  // Debounced refetch when endpoint, put in in a useEffect dependand on endpoint
  const debouncedRefetch = useCallback(
    debounce(() => {
      if (endPoint) {
        propertyList.refetch();
      }
    }, 1000),
    [endPoint] // Dependencies that the debounce function depends on
  );

  useEffect(() => {
    debouncedRefetch();
    // Clean up the debounce on unmount
    return () => {
      debouncedRefetch.cancel();
    };
  }, [endPoint, debouncedRefetch]);

  const savePresetApi = ApiPostCall({
    relatedQueryKeys: "ListGraphExplorerPresets",
  });

  // Save preset function
  const handleSavePreset = () => {
    const currentTemplate = formControl.getValues();

    savePresetApi.mutate({
      url: "/api/ExecGraphExplorerPreset",
      data: { action: "copy", preset: currentTemplate },
    });
  };

  const selectedPresets = useWatch({ control, name: "reportTemplate" });
  useEffect(() => {
    if (selectedPresets?.addedFields?.params) {
      Object.keys(selectedPresets.addedFields.params).forEach(
        (key) =>
          selectedPresets.addedFields.params[key] == null &&
          delete selectedPresets.addedFields.params[key]
      );
      //if $select is a blank array, set it to a string.
      if (
        selectedPresets.addedFields.params.$select &&
        selectedPresets.addedFields.params.$select.length === 0
      ) {
        selectedPresets.addedFields.params.$select = "";
      }
      selectedPresets.addedFields.params.$select
        ? (selectedPresets.addedFields.params.$select = selectedPresets.addedFields.params?.$select
            ?.split(",")
            .map((item) => ({ label: item, value: item })))
        : (selectedPresets.addedFields.params.$select = []);
      selectedPresets.addedFields.params.id = selectedPresets.value;
      console.log(selectedPresets.addedFields.params.id);
      selectedPresets.addedFields.params.name = selectedPresets.label;
      formControl.reset(selectedPresets?.addedFields?.params, { keepDefaultValues: true });
    }
  }, [selectedPresets]);

  // Schedule report function
  const handleScheduleReport = () => {
    console.log("Schedule Report:", formControl.getValues());
    setOffCanvasContent("this should be the scheduler form.");
    setOffCanvasOpen(true);
  };

  const [editorValues, setEditorValues] = useState({});
  //keep the editor in sync with the form

  useEffect(() => {
    const values = formControl.getValues();
    setOffCanvasContent(() => (
      <>
        <CippCodeBlock
          type="editor"
          onChange={(value) => setEditorValues(JSON.parse(value))}
          code={JSON.stringify(values, null, 2)}
        />
        <Button
          onClick={() => {
            savePresetApi.mutate({
              url: "/api/ExecGraphExplorerPreset",
              data: { action: "copy", preset: editorValues },
            });
          }}
          variant="contained"
          color="primary"
        >
          Import Template
        </Button>
        <CippApiResults apiObject={savePresetApi} />
      </>
    ));
  }, [editorValues, savePresetApi.isPending, formControl, selectedPresets]);

  const handleImport = () => {
    setOffCanvasOpen(true); // Open the offCanvas, the content will be updated by useEffect
  };
  // Handle filter form submission
  const onSubmit = (values) => {
    values.$select = values?.$select?.map((item) => item.value)?.join(",");
    onSubmitFilter(values);
    setCardExpanded(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CippButtonCard
        title="Graph Explorer Filter"
        cardSx={{ display: "flex", flexDirection: "column", height: "100%" }}
        cardActions={
          <Tooltip title="Expand/Collapse">
            <IconButton onClick={() => setCardExpanded(!cardExpanded)}>
              {cardExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
        }
      >
        <Collapse in={cardExpanded} timeout="auto" unmountOnExit>
          <Grid container spacing={2}>
            <Grid container item xs={12} sm={6} spacing={2}>
              <Grid item xs={12}>
                <CippFormComponent
                  type="autoComplete"
                  name="reportTemplate"
                  label="Select a Report Preset"
                  multiple={false}
                  formControl={formControl}
                  api={{
                    url: "/api/ListGraphExplorerPresets",
                    dataKey: "Results",
                    labelField: (option) => option.name,
                    valueField: (option) => option.id,
                    queryKey: "ListGraphExplorerPresets",
                    addedField: { params: "params" },
                  }}
                  placeholder="Select a preset"
                />
              </Grid>
              <Grid item xs={12}>
                <CippFormComponent
                  type="textField"
                  name="endpoint"
                  label="Endpoint"
                  formControl={formControl}
                  placeholder="Enter Graph API endpoint"
                />
              </Grid>

              <Grid item xs={12}>
                <CippFormComponent
                  type="autoComplete"
                  name="$select"
                  label="Select"
                  formControl={formControl}
                  isFetching={propertyList.isLoading}
                  options={
                    (propertyList.isSuccess &&
                      propertyList?.data?.Results?.map((item) => ({ label: item, value: item }))) ||
                    []
                  }
                  placeholder="Columns to select"
                  helperText="Comma-separated list of columns to include in the response"
                />
              </Grid>

              {/* Expand Field */}
              <Grid item xs={12}>
                <CippFormComponent
                  type="textField"
                  name="$expand"
                  label="Expand"
                  formControl={formControl}
                  placeholder="Expand related entities"
                />
              </Grid>
            </Grid>

            {/* Right Column */}
            <Grid container item xs={12} sm={6} spacing={2}>
              {/* Preset Name Field */}
              <Grid item xs={12}>
                <CippFormComponent
                  type="textField"
                  name="name"
                  label="Preset Name"
                  formControl={formControl}
                  placeholder="Name for this filter preset"
                />
              </Grid>

              {/* Filter Field */}
              <Grid item xs={12}>
                <CippFormComponent
                  type="textField"
                  name="$filter"
                  label="Filter"
                  formControl={formControl}
                  placeholder="OData filter"
                />
              </Grid>

              {/* Top Field */}
              <Grid item xs={12}>
                <CippFormComponent
                  type="number"
                  fullWidth
                  name="$top"
                  label="Top"
                  formControl={formControl}
                  placeholder="Number of records to return"
                />
              </Grid>

              {/* Search Field */}
              <Grid item xs={12}>
                <CippFormComponent
                  type="textField"
                  name="$search"
                  label="Search"
                  formControl={formControl}
                  placeholder="Search query"
                />
              </Grid>
            </Grid>

            {/* Reverse Tenant Lookup Switch */}
            <Grid item xs={12} sm={4}>
              <CippFormComponent
                type="switch"
                name="ReverseTenantLookup"
                label="Reverse Tenant Lookup"
                formControl={formControl}
              />
            </Grid>
            <CippFormCondition
              formControl={formControl}
              field={"ReverseTenantLookup"}
              compareValue={true}
            >
              {/* Reverse Tenant Lookup Property Field */}
              <Grid item xs={12} sm={12}>
                <CippFormComponent
                  type="textField"
                  name="ReverseTenantLookupProperty"
                  label="Reverse Tenant Lookup Property"
                  formControl={formControl}
                  placeholder="Enter the reverse tenant lookup property (e.g. tenantId)"
                />
              </Grid>
            </CippFormCondition>

            {/* No Pagination Switch */}
            <Grid item xs={12} sm={4}>
              <CippFormComponent
                type="switch"
                name="NoPagination"
                label="Disable Pagination"
                formControl={formControl}
              />
            </Grid>

            {/* $count Switch */}
            <Grid item xs={12} sm={4}>
              <CippFormComponent
                type="switch"
                name="$count"
                label="Use $count"
                formControl={formControl}
              />
            </Grid>

            {/* Buttons Row */}
            <Grid item xs={12} style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <Grid item xs={12}>
                  <Button variant="contained" color="primary" type="submit">
                    Apply Filter
                  </Button>
                </Grid>
              </div>
              <div>
                {/* Save Preset Button */}
                <Button
                  variant="contained"
                  onClick={handleSavePreset}
                  startIcon={<SaveIcon />}
                  style={{ marginRight: "8px" }}
                >
                  Save Preset
                </Button>

                {/* Schedule Report Button */}
                <Button
                  style={{ marginRight: "8px" }}
                  variant="contained"
                  onClick={handleScheduleReport}
                >
                  Schedule Report
                </Button>

                {/* Import/Export Button */}
                <Button onClick={handleImport} variant="outlined" color="primary">
                  Import/Export
                </Button>
              </div>
            </Grid>
            <Grid item xs={12}>
              <CippApiResults apiObject={savePresetApi} />
              <CippOffCanvas
                visible={offCanvasOpen}
                onClose={() => setOffCanvasOpen(false)}
                children={offCanvasContent}
              />
            </Grid>
          </Grid>
        </Collapse>
      </CippButtonCard>
    </form>
  );
};

export default CippGraphExplorerFilter;
