sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History",
    "emsd/ams/model/formatter"
], function (Controller, JSONModel, MessageToast, History, formatter) {
    "use strict";

    return Controller.extend("emsd.ams.controller.EquipmentList", {
        formatter: formatter,

        onInit: function () {
            // Initialize view model
            var oViewModel = new JSONModel({
                selectedCount: 0,
                tableTitle: this.getResourceBundle().getText("equipmentTableTitle")
            });
            this.getView().setModel(oViewModel, "view");

            // Get the router instance
            this.oRouter = this.getOwnerComponent().getRouter();

            // Register pattern matched event for this view
            this.oRouter.getRoute("equipmentList").attachPatternMatched(this._onRouteMatched, this);

            // Attach event handler for selection change
            var oTable = this.byId("equipmentTable");
            oTable.attachSelectionChange(this.onSelectionChange, this);

            // 延迟初始化SmartTable
            // this._initializeSmartTable();
 
        },

        _initializeSmartTable: function () {
            var that = this;
            setTimeout(function () {
                var oSmartTable = that.byId("equipmentSmartTable");
                if (oSmartTable && !oSmartTable.getBusy()) {
                    oSmartTable.rebindTable();
                }
            }, 500); // 延迟500毫秒，确保初始化完成
        },

          
        _onRouteMatched: function (oEvent) {
            var oSmartFilterBar = this.byId("equipmentSmartFilterBar");
            var oSmartTable = this.byId("equipmentSmartTable");
        
            if (oSmartFilterBar) {
                oSmartFilterBar.clear();
                oSmartFilterBar.search();
            }
        
            if (oSmartTable) {
                // 延迟调用rebindTable
                this._initializeSmartTable();
            }
        
            var oTable = this.byId("equipmentTable");
            if (oTable) {
                oTable.removeSelections(true);
                this._updateViewDetailsButton(0);
            }
        },

        /**
         * Handler for table selection change
         * @param {sap.ui.base.Event} oEvent selection change event
         */
        onSelectionChange: function (oEvent) {
            var oTable = oEvent.getSource();
            var aSelectedItems = oTable.getSelectedItems();
            var iSelectedCount = aSelectedItems.length;

            // Update view model
            this._updateViewDetailsButton(iSelectedCount);
        },

        /**
         * Updates the state of the view details button based on selection count
         * @param {int} iSelectedCount number of selected items
         * @private
         */
        _updateViewDetailsButton: function (iSelectedCount) {
            var oViewModel = this.getView().getModel("view");
            oViewModel.setProperty("/selectedCount", iSelectedCount);

            // Enable or disable view details button
            var oViewDetailsButton = this.byId("viewDetailsButton");
            oViewDetailsButton.setEnabled(iSelectedCount === 1);
        },

        /**
         * Handler for view details button press
         */
        onViewDetailsPress: function () {
            var oTable = this.byId("equipmentTable");
            var aSelectedItems = oTable.getSelectedItems();

            // Check if exactly one item is selected
            if (aSelectedItems.length !== 1) {
                MessageToast.show(this.getResourceBundle().getText("selectOneItemMessage"));
                return;
            }

            // Get the selected item context
            var oSelectedItem = aSelectedItems[0];
            var oContext = oSelectedItem.getBindingContext();
            var sPath = oContext.getPath();
            var sEquipmentId = oContext.getProperty("EquipmentNo");

            // Navigate to details page
            this.oRouter.navTo("equipmentDetails", {
                equipmentId: sEquipmentId
            });
        },

        /**
         * Gets the resource bundle
         * @returns {sap.ui.model.resource.ResourceModel} the resource model
         */
        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        }
    });
});