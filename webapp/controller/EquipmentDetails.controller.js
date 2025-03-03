sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, UIComponent, History, MessageToast, JSONModel, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("emsd.ams.controller.EquipmentDetails", {
        onInit: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("EquipmentDetails").attachPatternMatched(this._onObjectMatched, this);

            // Initialize edit mode model
            var oEditModeModel = new JSONModel({
                editMode: false
            });
            this.getView().setModel(oEditModeModel, "viewModel"); // 使用独立的viewModel命名空间，避免与OData模型冲突

            // Initialize Functional Location tree model
            this._initFunctionalLocTreeModel();
            
            // 初始化smart控件的OData模型
            this._initializeSmartControls();
        },
        
        /**
         * 初始化Smart控件
         */
        _initializeSmartControls: function() {
            var oView = this.getView();
            
            // 设置SmartForm的metadataContexts
            var oBasicInfoSmartForm = this.byId("basicInfoSmartForm");
            var oGeneralSmartForm = this.byId("generalSmartForm");
            var oOrganizationSmartForm = this.byId("organizationSmartForm");
            
            if (oBasicInfoSmartForm) {
                oBasicInfoSmartForm.setModel(this.getOwnerComponent().getModel());
            }
            
            if (oGeneralSmartForm) {
                oGeneralSmartForm.setModel(this.getOwnerComponent().getModel());
            }
            
            if (oOrganizationSmartForm) {
                oOrganizationSmartForm.setModel(this.getOwnerComponent().getModel());
            }
        },

        /**
         * Initialize Functional Location tree model
         */
        _initFunctionalLocTreeModel: function () {
            // Create empty tree model
            var oTreeModel = new JSONModel({
                funcLocTree: []
            });
            this.getView().setModel(oTreeModel, "funcLocTree");
        },

        /**
         * Event handler for pattern matched
         * @param {sap.ui.base.Event} oEvent - The pattern matched event
         */
        _onObjectMatched: function (oEvent) {
            var that = this;
            var sEquipmentId = oEvent.getParameter("arguments").equipmentId;
            
            // 重要修复：检查equipmentId有效性
            if (!sEquipmentId) {
                MessageToast.show("Equipment ID missing");
                return;
            }
            
            // 记录当前equipmentId用于后续操作
            this._sCurrentEquipmentId = sEquipmentId;

            // Reset edit mode - 修改为使用正确的viewModel
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/editMode", false);
            
            // 获取主数据模型
            var oModel = this.getOwnerComponent().getModel();
            if (!oModel) {
                console.error("Main OData model not found");
                return;
            }
            
            var sPath = "/EquipmentSet('" + sEquipmentId + "')";
            
            // 重要修复：先检查路径是否存在
            oModel.read(sPath, {
                success: function(oData) {
                    // 设置绑定上下文
                    var oContext = new sap.ui.model.Context(oModel, sPath);
                    that.getView().setBindingContext(oContext);
                    
                    // 如果有功能位置，加载功能位置层次结构
                    if (oData && oData.FunctionalLocation) {
                        that._loadFunctionalLocationHierarchy(oData.FunctionalLocation);
                    }
                    
                    // 通知Smart控件刷新
                    that._refreshSmartControls();
                },
                error: function(oError) {
                    // 错误处理
                    console.error("Failed to load equipment data:", oError);
                    MessageToast.show("Failed to load equipment data");
                }
            });
        },
        
        /**
         * 刷新Smart控件
         */
        _refreshSmartControls: function() {
            var oBasicInfoSmartForm = this.byId("basicInfoSmartForm");
            var oGeneralSmartForm = this.byId("generalSmartForm");
            var oOrganizationSmartForm = this.byId("organizationSmartForm");
            
            if (oBasicInfoSmartForm) {
                oBasicInfoSmartForm.bindElement(this.getView().getBindingContext().getPath());
            }
            
            if (oGeneralSmartForm) {
                oGeneralSmartForm.bindElement(this.getView().getBindingContext().getPath());
            }
            
            if (oOrganizationSmartForm) {
                oOrganizationSmartForm.bindElement(this.getView().getBindingContext().getPath());
            }
        },

        /**
         * Load Functional Location hierarchy
         * @param {string} sFuncLoc - Current Functional Location ID
         */
        _loadFunctionalLocationHierarchy: function(sFuncLoc) {
            var that = this;
            var oModel = this.getOwnerComponent().getModel();
            
            // 修复：使用OData读取功能位置数据
            if (oModel) {
                // 添加适当的筛选器以获取所有相关的功能位置
                var aFilters = [
                    new Filter("FunctionalLoc", FilterOperator.StartsWith, sFuncLoc.substr(0, 4))
                ];
                
                oModel.read("/FunctionalLocSet", {
                    filters: aFilters,
                    success: function(oData) {
                        if (oData && oData.results) {
                            console.log("Successfully retrieved Functional Locations data:", oData.results);
                            
                            // Build tree structure
                            var aHierarchy = that._buildFuncLocHierarchy(oData.results, sFuncLoc);
                            
                            // Set the hierarchy to the tree model
                            var oTreeModel = that.getView().getModel("funcLocTree");
                            oTreeModel.setProperty("/funcLocTree", aHierarchy);
                            
                            // Expand and select the current functional location
                            setTimeout(function() {
                                var oTree = that.byId("funcLocTree");
                                if (oTree) {
                                    that._expandPathTo(oTree, oTree.getItems(), sFuncLoc);
                                }
                            }, 500);
                        }
                    },
                    error: function(oError) {
                        console.error("Failed to load functional location data:", oError);
                    }
                });
            } else {
                // 回退到演示数据
                var oData = {
                    "results": [
                        {
                            "FunctionalLoc": "LDMS",
                            "Description": "LANDMARK SOUTH",
                            "ValidFrom": "/Date(1740873600000)/",
                            "Parent": null
                        },
                        {
                            "FunctionalLoc": "LDMS-001",
                            "Description": "LANDMARK SOUTH, SPORTS AND TOURISM BUREAU (CSTB)",
                            "ValidFrom": "/Date(1740873600000)/",
                            "Parent": {
                                "FunctionalLoc": "LDMS"
                            }
                        }
                    ]
                };
                
                // Process the functional locations
                var aFuncLocs = oData.results;
                console.log("Using demo data for Functional Locations:", aFuncLocs);
                
                // Build tree structure
                var aHierarchy = this._buildFuncLocHierarchy(aFuncLocs, sFuncLoc);
                
                // Set the hierarchy to the tree model
                var oTreeModel = this.getView().getModel("funcLocTree");
                oTreeModel.setProperty("/funcLocTree", aHierarchy);
                
                // Expand and select the current functional location
                setTimeout(function() {
                    var oTree = that.byId("funcLocTree");
                    if (oTree) {
                        that._expandPathTo(oTree, oTree.getItems(), sFuncLoc);
                    }
                }, 500);
            }
        },
        
        /**
         * Build Functional Location hierarchy
         * @param {Array} aFuncLocs - All Functional Locations
         * @param {string} sCurrentFuncLoc - Current Functional Location ID
         * @returns {Array} Hierarchy structure for tree
         */
        _buildFuncLocHierarchy: function(aFuncLocs, sCurrentFuncLoc) {
            var mFuncLocs = {}; // Map for quick lookup
            var aRoots = []; // Store root nodes
            
            // First build mapping of all nodes
            aFuncLocs.forEach(function(oFuncLoc) {
                var sId = oFuncLoc.FunctionalLoc;
                mFuncLocs[sId] = {
                    id: sId,
                    text: oFuncLoc.Description,
                    funcLoc: sId,
                    nodes: [],
                    parent: null
                };
            });
            
            // Build parent-child relationships
            aFuncLocs.forEach(function(oFuncLoc) {
                var sId = oFuncLoc.FunctionalLoc;
                var oNode = mFuncLocs[sId];
                
                // Check parent relationship
                if (oFuncLoc.Parent && typeof oFuncLoc.Parent === 'object') {
                    // If Parent is an object with metadata
                    if (oFuncLoc.Parent.FunctionalLoc) {
                        var sParentId = oFuncLoc.Parent.FunctionalLoc;
                        
                        if (mFuncLocs[sParentId]) {
                            var oParent = mFuncLocs[sParentId];
                            oParent.nodes.push(oNode);
                            oNode.parent = oParent;
                        } else {
                            aRoots.push(oNode);
                        }
                    } else {
                        aRoots.push(oNode);
                    }
                } else {
                    // No parent, add as root
                    aRoots.push(oNode);
                }
            });
            
            // Remove duplicate root nodes
            aRoots = aRoots.filter(function(oNode) {
                return !oNode.parent;
            });
            
            return aRoots;
        },

        /**
         * Expand the path to a specific Functional Location
         * @param {sap.m.Tree} oTree - The tree control
         * @param {Array} aItems - Tree items
         * @param {string} sFuncLoc - Target Functional Location ID
         * @returns {boolean} True if found and expanded
         */
        _expandPathTo: function (oTree, aItems, sFuncLoc) {
            // First find the target node
            var oTargetNode = null;
            var mFuncLocs = {};

            // Get all nodes from tree model
            var oModel = this.getView().getModel("funcLocTree");
            var aAllNodes = [];

            // Recursive function to traverse all nodes
            function collectNodes(aNodes) {
                aNodes.forEach(function (oNode) {
                    aAllNodes.push(oNode);
                    mFuncLocs[oNode.funcLoc] = oNode;
                    if (oNode.nodes && oNode.nodes.length > 0) {
                        collectNodes(oNode.nodes);
                    }
                });
            }

            // Collect all nodes
            collectNodes(oModel.getProperty("/funcLocTree"));

            // Find target node
            var oTargetNode = mFuncLocs[sFuncLoc];
            if (!oTargetNode) {
                return false;
            }

            // Get path from target node to root
            var aPath = [];
            var oCurrentNode = oTargetNode;

            while (oCurrentNode) {
                aPath.unshift(oCurrentNode); // Add to front of array
                oCurrentNode = oCurrentNode.parent;
            }

            // Expand path in order
            var oBinding = oTree.getBinding("items");

            // Start from root
            for (var i = 0; i < aPath.length - 1; i++) {
                var oNode = aPath[i];
                var oContext = oBinding.findNode(oNode.id);

                if (oContext) {
                    var iIndex = oContext.getIndex();
                    oBinding.expand(iIndex);
                }
            }

            // Finally select target node
            setTimeout(function () {
                var aItems = oTree.getItems();
                for (var i = 0; i < aItems.length; i++) {
                    var oItem = aItems[i];
                    var oItemContext = oItem.getBindingContext("funcLocTree");

                    if (oItemContext && oItemContext.getProperty("funcLoc") === sFuncLoc) {
                        oTree.setSelectedItem(oItem);
                        oItem.focus();
                        break;
                    }
                }
            }, 100);

            return true;
        },

        /**
         * Event handler for navigating back
         */
        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("EquipmentList", {}, true);
            }
        },

        /**
         * Event handler for editing equipment
         */
        onEditEquipment: function () {
            // 修改为使用正确的viewModel
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/editMode", true);
            
            // 通知Smart控件进入编辑模式
            this._setSmartControlsEditMode(true);
        },
        
        /**
         * 设置Smart控件编辑模式
         * @param {boolean} bEditMode - 是否处于编辑模式
         */
        _setSmartControlsEditMode: function(bEditMode) {
            var oBasicInfoSmartForm = this.byId("basicInfoSmartForm");
            var oGeneralSmartForm = this.byId("generalSmartForm");
            var oOrganizationSmartForm = this.byId("organizationSmartForm");
            
            if (oBasicInfoSmartForm) {
                oBasicInfoSmartForm.setEditable(bEditMode);
            }
            
            if (oGeneralSmartForm) {
                oGeneralSmartForm.setEditable(bEditMode);
            }
            
            if (oOrganizationSmartForm) {
                oOrganizationSmartForm.setEditable(bEditMode);
            }
        },
        
        /**
         * Event handler for saving equipment changes
         */
        onSaveEquipment: function() {
            var that = this;
            var oModel = this.getOwnerComponent().getModel();
            var sPath = "/EquipmentSet('" + this._sCurrentEquipmentId + "')";
            
            // 获取修改后的数据
            var oBindingContext = this.getView().getBindingContext();
            var oData = oBindingContext.getObject();
            
            // 使用OData更新
            oModel.update(sPath, oData, {
                success: function() {
                    MessageToast.show("Equipment data saved successfully");
                    
                    // 禁用编辑模式
                    var oViewModel = that.getView().getModel("viewModel");
                    oViewModel.setProperty("/editMode", false);
                    
                    // 更新Smart控件编辑模式
                    that._setSmartControlsEditMode(false);
                },
                error: function(oError) {
                    MessageToast.show("Error saving data: " + oError.message);
                }
            });
        },
        
        /**
         * Event handler for cancelling edit mode
         */
        onCancelEdit: function() {
            var that = this;
            
            // 重新读取数据
            var oModel = this.getOwnerComponent().getModel();
            var sPath = "/EquipmentSet('" + this._sCurrentEquipmentId + "')";
            
            oModel.read(sPath, {
                success: function(oData) {
                    // 设置绑定上下文
                    var oContext = new sap.ui.model.Context(oModel, sPath);
                    that.getView().setBindingContext(oContext);
                    
                    // 刷新Smart控件
                    that._refreshSmartControls();
                    
                    // 禁用编辑模式
                    var oViewModel = that.getView().getModel("viewModel");
                    oViewModel.setProperty("/editMode", false);
                    
                    // 更新Smart控件编辑模式
                    that._setSmartControlsEditMode(false);
                    
                    MessageToast.show("Edit cancelled");
                },
                error: function(oError) {
                    console.error("Failed to reload equipment data:", oError);
                    MessageToast.show("Failed to reload equipment data");
                }
            });
        },

        /**
         * Event handler for Functional Location node selection
         * @param {sap.ui.base.Event} oEvent - The tree item press event
         */
        onFuncLocNodeSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("funcLocTree");
            var sFuncLoc = oContext.getProperty("funcLoc");

            MessageToast.show("Selected Functional Location: " + sFuncLoc);
            
            // 可以在这里添加功能，例如更新当前设备的功能位置
            if (this.getView().getBindingContext() && this.getView().getModel("viewModel").getProperty("/editMode")) {
                // 如果处于编辑模式，允许用户选择新的功能位置
                var oModel = this.getOwnerComponent().getModel();
                var sPath = this.getView().getBindingContext().getPath();
                
                // 更新函数位置
                oModel.setProperty(sPath + "/FunctionalLocation", sFuncLoc);
                
                // 更新显示
                this._refreshSmartControls();
            }
        }
    });
});