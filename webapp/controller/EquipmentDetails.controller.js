sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/table/TreeTable"
], function (Controller, UIComponent, History, MessageToast, JSONModel, Filter, FilterOperator,TreeTable) {
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
 
            
            // First fetch the target location and all ancestors
            function fetchLocationWithAncestors(funcLoc) {
                return new Promise((resolve, reject) => {
                    var ancestorChain = [];
                    
                    function fetchLocation(currentFuncLoc) {
                        if (!currentFuncLoc) {
                            // Reverse the array to get root->leaf order
                            resolve(ancestorChain.reverse());
                            return;
                        }
                        
                        oModel.read("/FunctionalLocSet('" + currentFuncLoc + "')", {
                            success: function(oData) {
                                if (oData) {
                                    // Add this location to our chain
                                    ancestorChain.push({
                                        id: oData.FunctionalLoc,
                                        text: oData.Description,
                                        funcLoc: oData.FunctionalLoc,
                                        parent: oData.Parent
                                    });
                                    
                                    // Continue to parent if exists
                                    if (oData.Parent) {
                                        fetchLocation(oData.Parent);
                                    } else {
                                        // Reached the root, return the chain in root->leaf order
                                        resolve(ancestorChain.reverse());
                                    }
                                } else {
                                    resolve(ancestorChain.reverse());
                                }
                            },
                            error: function(oError) {
                                console.error("Error fetching functional location:", currentFuncLoc, oError);
                                resolve(ancestorChain.reverse());
                            }
                        });
                    }
                    
                    // Start fetching from the current location
                    fetchLocation(funcLoc);
                });
            }
            
            // Build a tree structure from the ancestor chain
            function buildTreeFromAncestors(ancestors) {
                if (!ancestors || ancestors.length === 0) {
                    return null;
                }
                
                // Start with the root node
                var rootNode = {
                    id: ancestors[0].id,
                    text: ancestors[0].text,
                    funcLoc: ancestors[0].funcLoc,
                    nodes: []
                };
                
                var currentNode = rootNode;
                
                // Build the path through the ancestors
                for (var i = 1; i < ancestors.length; i++) {
                    var newNode = {
                        id: ancestors[i].id,
                        text: ancestors[i].text,
                        funcLoc: ancestors[i].funcLoc,
                        nodes: []
                    };
                    
                    currentNode.nodes.push(newNode);
                    currentNode = newNode;
                }
                
                return rootNode;
            }
            
            // Now fetch children recursively starting from the leaf node
            function fetchChildren(parentNode) {
                return new Promise((resolve, reject) => {
                    oModel.read("/FunctionalLocSet", {
                        filters: [new sap.ui.model.Filter("Parent", sap.ui.model.FilterOperator.EQ, parentNode.funcLoc)],
                        success: function(oData) {
                            if (oData && oData.results && oData.results.length > 0) {
                                var childPromises = [];
                                
                                for (var i = 0; i < oData.results.length; i++) {
                                    var childData = oData.results[i];
                                    var childNode = {
                                        id: childData.FunctionalLoc,
                                        text: childData.Description,
                                        funcLoc: childData.FunctionalLoc,
                                        nodes: []
                                    };
                                    
                                    // Add child to parent's nodes
                                    parentNode.nodes.push(childNode);
                                    
                                    // Recursively fetch this child's children
                                    childPromises.push(fetchChildren(childNode));
                                }
                                
                                // Wait for all children to complete
                                Promise.all(childPromises).then(() => {
                                    resolve(parentNode);
                                }).catch(error => {
                                    console.error("Error fetching children:", error);
                                    resolve(parentNode);
                                });
                            } else {
                                // No children, resolve with current node
                                resolve(parentNode);
                            }
                        },
                        error: function(oError) {
                            console.error("Error fetching children for:", parentNode.funcLoc, oError);
                            resolve(parentNode);
                        }
                    });
                });
            }
            
            // Main execution flow
            fetchLocationWithAncestors(sFuncLoc)
                .then(function(ancestors) {
                    // Build the initial tree with the ancestor path
                    var rootNode = buildTreeFromAncestors(ancestors);
                    if (!rootNode) {
                        throw new Error("Could not find any functional locations");
                    }
                    
                    // Find the leaf node (target location) to start fetching its children
                    var leafNode = rootNode;
                    while (leafNode.nodes && leafNode.nodes.length > 0) {
                        leafNode = leafNode.nodes[0];
                    }
                    
                    // Fetch all children recursively starting from the leaf
                    return fetchChildren(leafNode).then(() => rootNode);
                })
                .then(function(completeHierarchy) {
                    // Create or get the existing model
                    var oTreeModel = that.getView().getModel("funcLocTree") || new sap.ui.model.json.JSONModel();
                    
                    if (!that.getView().getModel("funcLocTree")) {
                        that.getView().setModel(oTreeModel, "funcLocTree");
                    }
                    
                    // Set the complete hierarchy to the model
                    oTreeModel.setProperty("/funcLocTree", completeHierarchy ? [completeHierarchy] : []);
                    
                    // Auto-expand all levels for TreeTable
                    var oTreeTable = that.byId("funcLocTree");
                    if (oTreeTable) {
                        oTreeTable.expandToLevel(999); // Expand all levels
                    }
                })
                .catch(function(error) {
                    console.error("Failed to load functional location hierarchy:", error);
                    sap.m.MessageToast.show("无法加载功能位置层级结构");
                });
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