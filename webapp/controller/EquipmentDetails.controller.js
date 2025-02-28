sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "emsd/ams/model/formatter"
], function (Controller, JSONModel, History, MessageBox, formatter) {
    "use strict";

    return Controller.extend("emsd.ams.controller.EquipmentDetails", {
        formatter: formatter,
        
        onInit: function () {
            // Initialize view model
            var oViewModel = new JSONModel({
                busy: false,
                delay: 0
            });
            this.getView().setModel(oViewModel, "view");
            
            // Get the router instance
            var oRouter = this.getOwnerComponent().getRouter();
            
            // Register pattern matched event for this view
            oRouter.getRoute("equipmentDetails").attachPatternMatched(this._onRouteMatched, this);
        },
        
        /**
         * Handles route pattern matched event
         * @param {sap.ui.base.Event} oEvent pattern matched event
         * @private
         */
        _onRouteMatched: function (oEvent) {
            var oViewModel = this.getView().getModel("view");
            var oArgs = oEvent.getParameter("arguments");
            var sEquipmentId = oArgs.equipmentId;
            
            oViewModel.setProperty("/busy", true);
            
            // Bind the view to the equipment
            var sPath = this.getModel().createKey("/EquipmentSet", {
                EquipmentNo: sEquipmentId
            });
            
            this.getView().bindElement({
                path: sPath,
                events: {
                    dataRequested: function () {
                        oViewModel.setProperty("/busy", true);
                    },
                    dataReceived: function () {
                        oViewModel.setProperty("/busy", false);
                    },
                    change: this._onBindingChange.bind(this)
                }
            });
        },
        
        /**
         * Handler for binding change event
         * @private
         */
        _onBindingChange: function () {
            var oView = this.getView();
            var oElementBinding = oView.getElementBinding();
            
            // No data for the binding
            if (!oElementBinding.getBoundContext()) {
                this.getOwnerComponent().getRouter().getTargets().display("notFound");
                return;
            }
            
            // Update page title with equipment number and description
            var oResourceBundle = this.getResourceBundle();
            var oEquipment = oView.getBindingContext().getObject();
            var sEquipmentId = oEquipment.EquipmentNo;
            var sEquipmentDesc = oEquipment.EquipmentDescription;
            var sTitle = oResourceBundle.getText("equipmentDetailsPageTitle", [sEquipmentId, sEquipmentDesc]);
            
            this.getView().byId("equipmentDetailsPage").setTitle(sTitle);
        },
        
        /**
         * Handler for nav back button
         */
        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("equipmentList", {}, {});
            }
        },
        
        /**
         * Gets the OData model
         * @returns {sap.ui.model.odata.v2.ODataModel} the OData model
         */
        getModel: function () {
            return this.getOwnerComponent().getModel();
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