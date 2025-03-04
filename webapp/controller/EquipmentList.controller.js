sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/core/syncStyleClass"
], function (Controller, UIComponent, JSONModel, MessageToast, MessageBox,
    Fragment, syncStyleClass) {
    "use strict";

    return Controller.extend("emsd.ams.controller.EquipmentList", {
        onInit: function () {
            this._oTable = this.byId("equipmentSmartTable");

            // Initialize selection model for mass update buttons
            var oSelectionModel = new JSONModel({
                selectedContexts: []
            });
            this.getView().setModel(oSelectionModel, "equipmentSmartTable");

            // Wait for SmartTable initialization
            this._oTable.attachInitialise(this._initializeTable.bind(this));
        },

        /**
         * Initialize table settings
         * @private
         */
        _initializeTable: function () {
            var oInnerTable = this._oTable.getTable();

            // Set 10 records per page
            if (oInnerTable.isA("sap.m.Table")) {
                // For ResponsiveTable
                oInnerTable.setGrowing(true);
                oInnerTable.setGrowingThreshold(20); // Changed from 20 to 10

                // Enable pagination (instead of infinite scrolling)
                oInnerTable.setGrowingScrollToLoad(true);

                // 
                oInnerTable.addStyleClass("sapUiSizeCompact");
                oInnerTable.addStyleClass("equipmentTableScrollable");

                // Set MultiSelect mode
                oInnerTable.setMode("MultiSelect");

                // Register item press event (for row content clicks)
                oInnerTable.attachEvent("itemPress", this.onItemPress.bind(this));

                // Make entire rows clickable
                this._makeRowsClickable(oInnerTable);

                // Add event listener for table update to handle new rows
                oInnerTable.attachEvent("updateFinished", function () {
                    this._makeRowsClickable(oInnerTable);
                }.bind(this));

                // Add selection change event for mass update buttons
                oInnerTable.attachSelectionChange(this._updateSelectionModel.bind(this));
            }
            else if (oInnerTable.isA("sap.ui.table.Table")) {
                // For GridTable
                oInnerTable.setVisibleRowCount(20); // Changed from 20 to 10
                oInnerTable.setEnableBusyIndicator(true);
                oInnerTable.setFirstVisibleRow(0);

                // Set pagination mode
                oInnerTable.setNavigationMode(sap.ui.table.NavigationMode.Paginator);

                // Set MultiSelect mode
                oInnerTable.setSelectionMode("MultiToggle");
                oInnerTable.setSelectionBehavior("Row");

                // Register cell click event
                oInnerTable.attachEvent("cellClick", this.onCellClick.bind(this));

                // Register row selection event (for multi-select handling, not navigation)
                oInnerTable.attachEvent("rowSelectionChange", this.onRowSelectionChange.bind(this));

                // Make entire rows clickable
                oInnerTable.attachEvent("rowClick", this.onRowClick.bind(this));
            }

            // Add pointer cursor style
            this._addPointerCursorStyle();
        },

        /**
         * Update selection model for mass update button enablement
         * @private
         */
        _updateSelectionModel: function (oEvent) {
            var oTable = oEvent.getSource();
            var aSelectedContexts = [];

            if (oTable.isA("sap.m.Table")) {
                aSelectedContexts = oTable.getSelectedItems().map(function (oItem) {
                    return oItem.getBindingContext();
                });
            } else if (oTable.isA("sap.ui.table.Table")) {
                aSelectedContexts = oTable.getSelectedIndices().map(function (iIndex) {
                    return oTable.getContextByIndex(iIndex);
                });
            }

            // Update selection model
            this.getView().getModel("equipmentSmartTable").setProperty("/selectedContexts", aSelectedContexts);
        },

        /**
         * Make table rows clickable
         * @param {sap.m.Table} oTable - Table instance
         * @private
         */
        _makeRowsClickable: function (oTable) {
            var aItems = oTable.getItems();

            for (var i = 0; i < aItems.length; i++) {
                var oItem = aItems[i];

                // Add cursor pointer style to each row
                oItem.addStyleClass("cursorPointer");

                // Get all cells in the row
                var aCells = oItem.getCells();
                for (var j = 0; j < aCells.length; j++) {
                    var oCell = aCells[j];

                    // Check if the cell has the attachPress/detachPress methods
                    if (oCell.attachPress && typeof oCell.attachPress === "function" &&
                        oCell.detachPress && typeof oCell.detachPress === "function") {
                        // Remove existing handlers to avoid duplicates
                        oCell.detachPress(this._onCellPress, this);
                        oCell.attachPress(this._onCellPress.bind(this));
                    }

                    // Handle interactive elements separately
                    this._makeElementClickable(oCell, oItem);
                }
            }
        },

        /**
         * Add click handling to an element
         * @param {sap.ui.core.Control} oControl - UI control
         * @param {sap.m.ColumnListItem} oItem - Corresponding row item
         * @private
         */
        _makeElementClickable: function (oControl, oItem) {
            // Add style and click event to control
            oControl.addStyleClass("cursorPointer");

            // Handle special cases for controls that already have click/press events
            if (!oControl.isA("sap.m.Button") &&
                !oControl.isA("sap.m.CheckBox") &&
                !oControl.isA("sap.m.RadioButton")) {

                // Add click event to element, ensuring event bubbling
                if (oControl.attachBrowserEvent) {
                    oControl.attachBrowserEvent("click", function (oEvent) {
                        // Prevent event bubbling to CheckBox etc.
                        if (oEvent.target.tagName !== "INPUT" &&
                            oEvent.target.tagName !== "BUTTON") {
                            this._navigateToDetails(oItem);
                            oEvent.stopPropagation();
                        }
                    }.bind(this));
                }
            }

            // Process aggregated controls recursively
            if (oControl.getAggregation) {
                var mAggregations = oControl.getMetadata().getAllAggregations();
                for (var sAggregationName in mAggregations) {
                    var aAggregation = oControl.getAggregation(sAggregationName);
                    if (Array.isArray(aAggregation)) {
                        aAggregation.forEach(function (oAggregatedControl) {
                            this._makeElementClickable(oAggregatedControl, oItem);
                        }.bind(this));
                    } else if (aAggregation && aAggregation.addStyleClass) {
                        this._makeElementClickable(aAggregation, oItem);
                    }
                }
            }
        },

        /**
         * Cell press event handler
         * @param {sap.ui.base.Event} oEvent - Event object
         * @private
         */
        _onCellPress: function (oEvent) {
            var oControl = oEvent.getSource();
            var oItem = oControl.getParent();

            // Check if directly clicking CheckBox or Button
            var oTarget = oEvent.getParameter("srcControl");
            if (oTarget && (
                oTarget.isA("sap.m.CheckBox") ||
                oTarget.isA("sap.m.RadioButton") ||
                oTarget.isA("sap.m.Button"))) {
                return; // Don't handle selection control clicks
            }

            // Navigate to details page
            this._navigateToDetails(oItem);
        },

        /**
         * Navigate to details page
         * @param {sap.m.ColumnListItem} oItem - Row item
         * @private
         */
        _navigateToDetails: function (oItem) {
            var oContext = oItem.getBindingContext();

            if (oContext) {
                // Navigate to equipment details page
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("EquipmentDetails", {
                    equipmentId: oContext.getProperty("EquipmentNo")
                });
            }
        },

        /**
         * Add pointer style CSS
         * @private
         */
        _addPointerCursorStyle: function () {
            // Check if style is already added
            if (!document.getElementById("equipmentTableCursorStyle")) {
                var oStyle = document.createElement("style");
                oStyle.id = "equipmentTableCursorStyle";
                oStyle.type = "text/css";
                oStyle.innerHTML = ".cursorPointer { cursor: pointer; } " +
                    ".equipmentTableScrollable { height: 75vh; overflow: auto; }";
                document.getElementsByTagName("head")[0].appendChild(oStyle);
            }
        },

        /**
         * Item press event handler (for sap.m.Table row item press)
         * @param {sap.ui.base.Event} oEvent - Event object
         */
        onItemPress: function (oEvent) {
            var oItem = oEvent.getParameter("listItem") || oEvent.getSource();

            // Check if directly clicking CheckBox
            var oTarget = oEvent.getParameter("srcControl");
            if (oTarget && (
                oTarget.isA("sap.m.CheckBox") ||
                oTarget.isA("sap.m.RadioButton"))) {
                return; // Don't handle selection control clicks
            }

            this._navigateToDetails(oItem);
        },

        /**
         * Row click event handler (for sap.ui.table.Table)
         * @param {sap.ui.base.Event} oEvent - Event object
         */
        onRowClick: function (oEvent) {
            var oTable = oEvent.getSource();
            var iRowIndex = oEvent.getParameter("rowIndex");

            // Skip if clicked on selection cell or out of bounds
            if (iRowIndex >= 0) {
                var oContext = oTable.getContextByIndex(iRowIndex);

                if (oContext) {
                    // Navigate to equipment details page
                    var oRouter = UIComponent.getRouterFor(this);
                    oRouter.navTo("EquipmentDetails", {
                        equipmentId: oContext.getProperty("EquipmentNo")
                    });
                }
            }
        },

        /**
         * Cell click event handler (for sap.ui.table.Table)
         * @param {sap.ui.base.Event} oEvent - Event object
         */
        onCellClick: function (oEvent) {
            var oTable = oEvent.getSource();
            var iRowIndex = oEvent.getParameter("rowIndex");
            var iColIndex = oEvent.getParameter("columnIndex");

            // Check if not clicking selection column
            if (iColIndex > 0 && iRowIndex >= 0) {
                var oContext = oTable.getContextByIndex(iRowIndex);

                if (oContext) {
                    // Navigate to equipment details page
                    var oRouter = UIComponent.getRouterFor(this);
                    oRouter.navTo("EquipmentDetails", {
                        equipmentId: oContext.getProperty("EquipmentNo")
                    });
                }
            }
        },

        /**
         * Row selection change event handler (for sap.ui.table.Table, only handles multi-select, no navigation)
         * @param {sap.ui.base.Event} oEvent - Event object
         */
        onRowSelectionChange: function (oEvent) {
            // Only handle selection state changes, don't navigate to details page
            // Can get selected rows and perform other operations here
            var aIndices = oEvent.getSource().getSelectedIndices();
            console.log("Selected indices: ", aIndices);
        },

        /**
         * Create new equipment event handler
         */
        onCreateEquipment: function () {
            MessageToast.show("Create Equipment function not implemented in this demo");
        },

        /**
         * Before table rebind event handler
         * @param {sap.ui.base.Event} oEvent - Event object
         */
        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            // Set pagination parameters
            if (!mBindingParams.parameters) {
                mBindingParams.parameters = {};
            }

            // Set max records per page to 10
            mBindingParams.parameters.$top = 20;

            mBindingParams.parameters.$inlinecount = "allpages";

            // Can add additional filters or parameters here
            var oSmartFilterBar = this.byId("equipmentSmartFilterBar");
            var sSearchQuery = oSmartFilterBar.getBasicSearchValue();

            if (sSearchQuery) {
                // Add filter for each searchable field
                if (!mBindingParams.filters) {
                    mBindingParams.filters = [];
                }

                var oFilter = new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("EquipmentNo", sap.ui.model.FilterOperator.Contains, sSearchQuery),
                        new sap.ui.model.Filter("EquipmentDescription", sap.ui.model.FilterOperator.Contains, sSearchQuery),
                        new sap.ui.model.Filter("ModelNo", sap.ui.model.FilterOperator.Contains, sSearchQuery),
                        new sap.ui.model.Filter("ManufacturerSerialNo", sap.ui.model.FilterOperator.Contains, sSearchQuery)
                    ],
                    and: false
                });

                mBindingParams.filters.push(oFilter);
            }
        },
        // ------------------- Template Actions Methods -------------------

        /**
         * Generate blank template for equipment creation
         */
        onGenerateBlank: function () {
            // Generate blank Excel template for equipment creation
            MessageToast.show("Generating blank template...");

            // Example implementation - replace with actual template generation logic
            var sServiceUrl = this.getOwnerComponent().getModel().sServiceUrl;
            var sDownloadUrl = sServiceUrl + "/GenerateBlankTemplateSet";

            // Create hidden iframe for download
            var oFrame = document.createElement("iframe");
            oFrame.style.display = "none";
            oFrame.src = sDownloadUrl;
            document.body.appendChild(oFrame);

            // Remove iframe after download starts
            setTimeout(function () {
                document.body.removeChild(oFrame);
            }, 1000);
        },

        /**
         * Generate template with current data selection
         */
        onGenerateWithData: function () {
            var oTable = this._oTable.getTable();
            var aSelectedItems = [];

            if (oTable.isA("sap.m.Table")) {
                aSelectedItems = oTable.getSelectedItems();
            } else if (oTable.isA("sap.ui.table.Table")) {
                var aSelectedIndices = oTable.getSelectedIndices();
                aSelectedItems = aSelectedIndices.map(function (iIndex) {
                    return oTable.getContextByIndex(iIndex);
                });
            }

            if (aSelectedItems.length === 0) {
                MessageBox.information("Please select at least one equipment to generate template with data.");
                return;
            }

            // Example - collect selected equipment IDs
            var aEquipmentIds = aSelectedItems.map(function (oItem) {
                if (oItem.getBindingContext) {
                    return oItem.getBindingContext().getProperty("EquipmentNo");
                } else {
                    return oItem.getProperty("EquipmentNo");
                }
            });

            MessageToast.show("Generating template with data for " + aEquipmentIds.length + " equipment(s)...");

            // Example implementation - replace with actual template generation logic
            var sServiceUrl = this.getOwnerComponent().getModel().sServiceUrl;
            var sDownloadUrl = sServiceUrl + "/GenerateTemplateWithDataSet?$filter=EquipmentNo eq '" +
                aEquipmentIds.join("' or EquipmentNo eq '") + "'";

            // Create hidden iframe for download
            var oFrame = document.createElement("iframe");
            oFrame.style.display = "none";
            oFrame.src = sDownloadUrl;
            document.body.appendChild(oFrame);

            // Remove iframe after download starts
            setTimeout(function () {
                document.body.removeChild(oFrame);
            }, 1000);
        },

        /**
         * Upload equipment data template
         */
        onUpload: function () {
            var that = this;

            // Create upload dialog if it doesn't exist
            if (!this._oUploadDialog) {
                Fragment.load({
                    name: "emsd.ams.view.fragment.UploadTemplate",
                    controller: this
                }).then(function (oDialog) {
                    that._oUploadDialog = oDialog;
                    that.getView().addDependent(that._oUploadDialog);
                    syncStyleClass("sapUiSizeCompact", that.getView(), that._oUploadDialog);
                    that._oUploadDialog.open();
                });
            } else {
                this._oUploadDialog.open();
            }
        },

        /**
         * Handle file upload
         */
        onFileUploadChange: function (oEvent) {
            this._oFile = oEvent.getParameter("files")[0];
            if (this._oFile) {
                var oUploadButton = this.byId("templateUploadButton");
                if (oUploadButton) {
                    oUploadButton.setEnabled(true);
                }
            }
        },

        /**
         * Process template upload
         */
        onUploadTemplate: function () {
            if (!this._oFile) {
                MessageToast.show("Please select a file to upload");
                return;
            }

            var oUploader = this.byId("fileUploader");
            var sUrl = this.getOwnerComponent().getModel().sServiceUrl + "/UploadTemplateSet";

            if (oUploader) {
                oUploader.setUploadUrl(sUrl);
                oUploader.upload();
            }

            this._oUploadDialog.close();
            MessageToast.show("Uploading template...");

            // Handle upload success/error in uploadComplete event
        },

        /**
         * Handle upload completion
         */
        onUploadComplete: function (oEvent) {
            var sResponse = oEvent.getParameter("response");
            var sStatus = oEvent.getParameter("status");

            if (sStatus === 200 || sStatus === 201) {
                MessageToast.show("Template uploaded successfully");
                // Refresh table
                this._oTable.rebindTable();
            } else {
                MessageBox.error("Upload failed: " + sResponse);
            }
        },

        /**
         * Close upload dialog
         */
        onCancelUpload: function () {
            this._oUploadDialog.close();
        },

        // ------------------- Mass Update Methods -------------------

        /**
         * Update cost center for selected equipment
         */
        onUpdateCostCenter: function () {
            var aSelectedContexts = this.getView().getModel("equipmentSmartTable").getProperty("/selectedContexts");

            if (aSelectedContexts.length === 0) {
                MessageBox.information("Please select at least one equipment to update cost center.");
                return;
            }

            var that = this;

            // Create dialog if it doesn't exist
            if (!this._oCostCenterDialog) {
                Fragment.load({
                    name: "emsd.ams.view.fragment.UpdateCostCenter",
                    controller: this
                }).then(function (oDialog) {
                    that._oCostCenterDialog = oDialog;
                    that.getView().addDependent(that._oCostCenterDialog);
                    syncStyleClass("sapUiSizeCompact", that.getView(), that._oCostCenterDialog);

                    // Set count of selected equipment
                    var oModel = new JSONModel({
                        count: aSelectedContexts.length
                    });
                    that._oCostCenterDialog.setModel(oModel, "costCenter");
                    that._oCostCenterDialog.open();
                });
            } else {
                // Update count of selected equipment
                this._oCostCenterDialog.getModel("costCenter").setProperty("/count", aSelectedContexts.length);
                this._oCostCenterDialog.open();
            }
        },

        /**
         * Apply cost center update
         */
        onApplyCostCenter: function () {
            var sCostCenter = this.byId("costCenterInput").getValue();

            if (!sCostCenter) {
                MessageToast.show("Please enter a cost center");
                return;
            }

            var aSelectedContexts = this.getView().getModel("equipmentSmartTable").getProperty("/selectedContexts");
            var aEquipmentIds = aSelectedContexts.map(function (oContext) {
                return oContext.getProperty("EquipmentNo");
            });

            // Example implementation - replace with actual update logic
            var oModel = this.getOwnerComponent().getModel();
            var oBatchGroup = "massUpdateCostCenter";
            oModel.setDeferredGroups([oBatchGroup]);

            // Create batch requests
            for (var i = 0; i < aEquipmentIds.length; i++) {
                var sPath = "/EquipmentSet('" + aEquipmentIds[i] + "')";
                oModel.update(sPath, {
                    CostCenter: sCostCenter
                }, {
                    groupId: oBatchGroup
                });
            }

            // Submit batch
            oModel.submitChanges({
                groupId: oBatchGroup,
                success: function (oData) {
                    MessageToast.show("Cost center updated for " + aEquipmentIds.length + " equipment(s)");
                    this._oCostCenterDialog.close();
                    this._oTable.rebindTable();
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Failed to update cost center: " + oError.message);
                }
            });
        },

        /**
         * Cancel cost center update
         */
        onCancelCostCenter: function () {
            this._oCostCenterDialog.close();
        },

        /**
         * Update user status for selected equipment
         */
        onUpdateUserStatus: function () {
            var aSelectedContexts = this.getView().getModel("equipmentSmartTable").getProperty("/selectedContexts");

            if (aSelectedContexts.length === 0) {
                MessageBox.information("Please select at least one equipment to update user status.");
                return;
            }

            var that = this;

            // Create dialog if it doesn't exist
            if (!this._oUserStatusDialog) {
                Fragment.load({
                    name: "emsd.ams.view.fragment.UpdateUserStatus",
                    controller: this
                }).then(function (oDialog) {
                    that._oUserStatusDialog = oDialog;
                    that.getView().addDependent(that._oUserStatusDialog);
                    syncStyleClass("sapUiSizeCompact", that.getView(), that._oUserStatusDialog);

                    // Set count of selected equipment
                    var oModel = new JSONModel({
                        count: aSelectedContexts.length
                    });
                    that._oUserStatusDialog.setModel(oModel, "userStatus");
                    that._oUserStatusDialog.open();
                });
            } else {
                // Update count of selected equipment
                this._oUserStatusDialog.getModel("userStatus").setProperty("/count", aSelectedContexts.length);
                this._oUserStatusDialog.open();
            }
        },

        /**
         * Apply user status update
         */
        onApplyUserStatus: function () {
            var sUserStatus = this.byId("userStatusSelect").getSelectedKey();

            if (!sUserStatus) {
                MessageToast.show("Please select a user status");
                return;
            }

            var aSelectedContexts = this.getView().getModel("equipmentSmartTable").getProperty("/selectedContexts");
            var aEquipmentIds = aSelectedContexts.map(function (oContext) {
                return oContext.getProperty("EquipmentNo");
            });

            // Example implementation - replace with actual update logic
            var oModel = this.getOwnerComponent().getModel();
            var oBatchGroup = "massUpdateUserStatus";
            oModel.setDeferredGroups([oBatchGroup]);

            // Create batch requests
            for (var i = 0; i < aEquipmentIds.length; i++) {
                var sPath = "/EquipmentSet('" + aEquipmentIds[i] + "')";
                oModel.update(sPath, {
                    UserStatus: sUserStatus
                }, {
                    groupId: oBatchGroup
                });
            }

            // Submit batch
            oModel.submitChanges({
                groupId: oBatchGroup,
                success: function (oData) {
                    MessageToast.show("User status updated for " + aEquipmentIds.length + " equipment(s)");
                    this._oUserStatusDialog.close();
                    this._oTable.rebindTable();
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Failed to update user status: " + oError.message);
                }
            });
        },

        /**
         * Cancel user status update
         */
        onCancelUserStatus: function () {
            this._oUserStatusDialog.close();
        },

        // ------------------- Create Equipment Dialog -------------------

        /**
         * Create new equipment event handler
         */
        onCreateEquipment: function () {
            var that = this;

            // Create dialog if it doesn't exist
            if (!this._oCreateDialog) {
                Fragment.load({
                    name: "emsd.ams.view.fragment.CreateEquipment",
                    controller: this
                }).then(function (oDialog) {
                    that._oCreateDialog = oDialog;
                    that.getView().addDependent(that._oCreateDialog);
                    syncStyleClass("sapUiSizeCompact", that.getView(), that._oCreateDialog);

                    // Create a new context for the equipment
                    var oModel = that.getOwnerComponent().getModel();
                    var oContext = oModel.createEntry("/EquipmentSet", {
                        properties: {
                            EquipmentNo: "",
                            EquipmentDescription: "",
                            ModelNo: "",
                            ManufacturerSerialNo: "",
                            FunctionalLocation: "",
                            UserStatus: ""
                        }
                    });

                    that._oCreateDialog.setBindingContext(oContext);
                    that._oCreateDialog.open();
                });
            } else {
                // Create a new context for the equipment
                var oModel = this.getOwnerComponent().getModel();
                var oContext = oModel.createEntry("/EquipmentSet", {
                    properties: {
                        EquipmentNo: "",
                        EquipmentDescription: "",
                        ModelNo: "",
                        ManufacturerSerialNo: "",
                        FunctionalLocation: "",
                        UserStatus: ""
                    }
                });

                this._oCreateDialog.setBindingContext(oContext);
                this._oCreateDialog.open();
            }
        },

        /**
         * Save new equipment
         */
        onSaveEquipment: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oContext = this._oCreateDialog.getBindingContext();

            oModel.submitChanges({
                success: function () {
                    MessageToast.show("Equipment created successfully");
                    this._oCreateDialog.close();
                    this._oTable.rebindTable();
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Failed to create equipment: " + oError.message);
                }
            });
        },

        /**
         * Cancel equipment creation
         */
        onCancelCreate: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oContext = this._oCreateDialog.getBindingContext();

            // Remove the created entry
            oModel.deleteCreatedEntry(oContext);
            this._oCreateDialog.close();
        }
    });
});