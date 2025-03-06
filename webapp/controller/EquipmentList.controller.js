sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/core/syncStyleClass",
    "sap/m/MultiInput",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library"
], function (Controller, UIComponent, JSONModel, MessageToast, MessageBox,
    Fragment, syncStyleClass, MultiInput, Dialog, Button, Label, Input, Spreadsheet, exportLibrary) {
    "use strict";

    return Controller.extend("emsd.ams.controller.EquipmentList", {
        onInit: function () {
            // Load XLSX library
            this._loadXLSXLibrary();

            this._oTable = this.byId("equipmentSmartTable");

            // Initialize selection model for mass update buttons
            var oSelectionModel = new JSONModel({
                selectedContexts: []
            });
            this.getView().setModel(oSelectionModel, "equipmentSmartTable");

            // Wait for SmartTable initialization
            this._oTable.attachInitialise(this._initializeTable.bind(this));
        },

        _loadXLSXLibrary: function () {
            var that = this;

            // 动态加载 XLSX 库
            jQuery.ajax({
                // url: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.5/xlsx.full.min.js",
                url: "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js",
                dataType: "script",
                cache: true,
                success: function () {
                    that._xlsxLoaded = true;
                    MessageToast.show("XLSX Library Loaded");
                },
                error: function () {
                    MessageBox.error("Failed to load XLSX library");
                }
            });
            jQuery.ajax({
                url: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
                dataType: "script",
                cache: true 
            });
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
        // onGenerateBlank: function () {
        //     // Generate blank Excel template for equipment creation
        //     MessageToast.show("Generating blank template...");

        //     // Example implementation - replace with actual template generation logic
        //     var sServiceUrl = this.getOwnerComponent().getModel().sServiceUrl;
        //     var sDownloadUrl = sServiceUrl + "/GenerateBlankTemplateSet";

        //     // Create hidden iframe for download
        //     var oFrame = document.createElement("iframe");
        //     oFrame.style.display = "none";
        //     oFrame.src = sDownloadUrl;
        //     document.body.appendChild(oFrame);

        //     // Remove iframe after download starts
        //     setTimeout(function () {
        //         document.body.removeChild(oFrame);
        //     }, 1000);
        // },


        onGenerateBlank: function () {
            var that = this;

            if (!this._oGenerateDialog) {
                // 创建输入控件但不立即添加ID
                var oEquipmentTypeInput = new Input({
                    placeholder: "{i18n>enterEquipmentTypePlaceholder}",
                    liveChange: function (oEvent) {
                        var sEquipmentType = oEvent.getParameter("value");
                        var oClassInput = that._oClassMultiInput;
                        if (sEquipmentType && oClassInput) {
                            var aTokens = oClassInput.getTokens().map(function (oToken) {
                                return oToken.getText();
                            });
                            if (!aTokens.some(function (token) {
                                return token === sEquipmentType + "_Class";
                            })) {
                                oClassInput.addToken(new sap.m.Token({
                                    text: sEquipmentType + "_Class"
                                }));
                            }
                        }
                    }
                });

                var oClassMultiInput = new MultiInput({
                    placeholder: "{i18n>enterClassPlaceholder}",
                    tokenUpdate: function (oEvent) {
                        var sEquipmentType = that._oEquipmentTypeInput.getValue();
                        if (sEquipmentType && oEvent.getParameter("type") === "added") {
                            var aTokens = oEvent.getParameter("addedTokens");
                            aTokens.forEach(function (oToken) {
                                if (!oToken.getText().endsWith("_" + sEquipmentType)) {
                                    oToken.setText(oToken.getText() + "_" + sEquipmentType);
                                }
                            });
                        }
                    }
                });

                // 保存对控件的引用
                this._oEquipmentTypeInput = oEquipmentTypeInput;
                this._oClassMultiInput = oClassMultiInput;

                this._oGenerateDialog = new Dialog({
                    title: "{i18n>generateBlankDialogTitle}",
                    content: [
                        new Label({
                            text: "{i18n>equipmentTypeLabel}",
                            labelFor: oEquipmentTypeInput
                        }),
                        oEquipmentTypeInput,
                        new Label({
                            text: "{i18n>classLabel}",
                            labelFor: oClassMultiInput
                        }),
                        oClassMultiInput
                    ],
                    beginButton: new Button({
                        text: "{i18n>okButtonText}",
                        press: function () {
                            var sEquipmentType = that._oEquipmentTypeInput.getValue();
                            var aClasses = that._oClassMultiInput.getTokens().map(function (oToken) {
                                return oToken.getText();
                            });
                            if (!sEquipmentType) {
                                MessageBox.error(that.getResourceBundle().getText("enterEquipmentTypeMessage"));
                                return;
                            }
                            that._generateBlankExcel(sEquipmentType, aClasses);
                            that._oGenerateDialog.close();
                        }
                    }),
                    endButton: new Button({
                        text: "{i18n>cancelButtonText}",
                        press: function () {
                            that._oGenerateDialog.close();
                        }
                    }),
                    afterClose: function () {
                        that._oGenerateDialog.destroy();
                        that._oEquipmentTypeInput = null;
                        that._oClassMultiInput = null;
                        that._oGenerateDialog = null;
                    }
                });
            }
            that.getView().addDependent(that._oCostCenterDialog);
            // 添加这一行
            this._oGenerateDialog.setModel(this.getOwnerComponent().getModel("i18n"), "i18n");

            this._oGenerateDialog.open();
        },

        _generateBlankExcel: function (sEquipmentType, aClasses) {
            var wb = XLSX.utils.book_new();
            var wsData = [];
            wsData.push(["EquipmentType", "Class", "EquipmentNo", "EquipmentDescription", "ModelNo", "ManufacturerSerialNo", "FunctionalLocation", "UserStatus", "CostCenter"]);
            aClasses.forEach(function (sClass) {
                wsData.push([sEquipmentType, sClass, "", "", "", "", "", "", ""]);
            });
            var ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "BlankTemplate");
            var wbout = XLSX.write(wb, { bookType: "xlsx", type: "binary" });

            function s2ab(s) {
                var buf = new ArrayBuffer(s.length);
                var view = new Uint8Array(buf);
                for (var i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
                return buf;
            }

            saveAs(new Blob([s2ab(wbout)], { type: "application/octet-stream" }), "BlankTemplate_" + sEquipmentType + ".xlsx");
            MessageBox.success(this.getResourceBundle().getText("generateSuccessMessage"));
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /**
         * Generate template with current data selection
         */

        /**
         * Export current data to Excel
         */
        /**
         * Export current data to Excel with enhanced column handling
         */
        // 状态配置
        _statusConfig: {
            'AVLB': {
                label: 'Available',
                color: {
                    patternType: 'solid',
                    fgColor: { rgb: "90EE90" }
                },
                hexColor: '#90EE90'
            },
            'MAINT': {
                label: 'Maintenance',
                color: {
                    patternType: 'solid',
                    fgColor: { rgb: "FFD700" }
                },
                hexColor: '#FFD700'
            },
            'MALF': {
                label: 'Malfunction',
                color: {
                    patternType: 'solid',
                    fgColor: { rgb: "FF6347" }
                },
                hexColor: '#FF6347'
            }
        },

        onExportBlank: function (bEmptyTemplate) {
            // 检查 ExcelJS 是否已加载
            if (typeof ExcelJS === 'undefined') {
                MessageBox.error("ExcelJS library is not loaded");
                return;
            }

            // 创建工作簿和工作表
            var workbook = new ExcelJS.Workbook();
            var worksheet = workbook.addWorksheet("Equipment List");

            // 准备状态值列表
            const statusValues = Object.keys(this._statusConfig);

            // 定义表头
            const headers = [
                "Equipment Number",
                "Equipment Description",
                "Model Number",
                "Manufacturer Serial Number",
                "User Status",
                "Functional Location",
                "Cost Center"
            ];

            // 添加表头
            worksheet.columns = [
                { header: headers[0], key: 'equipmentNo' },
                { header: headers[1], key: 'equipmentDescription' },
                { header: headers[2], key: 'modelNo' },
                { header: headers[3], key: 'manufacturerSerialNo' },
                { header: headers[4], key: 'userStatus' },
                { header: headers[5], key: 'functionalLocation' },
                { header: headers[6], key: 'costCenter' }
            ];

            // 获取表头行并加粗
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };

            // 数据验证配置
            const dataValidation = {
                type: 'list',
                allowBlank: false,
                formulae: [`"${statusValues.join(',')}"`],
                showErrorMessage: true,
                errorStyle: 'error',
                errorTitle: 'Invalid Input',
                error: 'Please select a value from the dropdown list'
            };

            // 默认的空状态配置
            const defaultStatusInfo = this._statusConfig[''] ||
                { color: { fgColor: { rgb: '#F0F0F0' } } }; // 浅灰色作为默认

            // 导出空模板，默认10行
            const iTemplateRowCount = 10;
            for (let i = 0; i < iTemplateRowCount; i++) {
                const rowData = {
                    equipmentNo: '',
                    equipmentDescription: '',
                    modelNo: '',
                    manufacturerSerialNo: '',
                    userStatus: '',
                    functionalLocation: '',
                    costCenter: ''
                };

                const row = worksheet.addRow(rowData);

                // 获取所有单元格并设置样式
                const columns = ['userStatus', 'equipmentNo', 'equipmentDescription',
                    'modelNo', 'manufacturerSerialNo',
                    'functionalLocation', 'costCenter'];

                columns.forEach(columnKey => {
                    const cell = row.getCell(columnKey);

                    // 对 User Status 单元格应用特定样式和验证
                    if (columnKey === 'userStatus') {
                        const statusInfo = defaultStatusInfo;

                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: statusInfo.color.fgColor.rgb.replace('#', 'FF') }
                        };

                        cell.dataValidation = dataValidation;
                    }
                });
            }

            // 调整列宽
            worksheet.columns.forEach(column => {
                column.width = 20;
            });

            // 导出文件
            workbook.xlsx.writeBuffer().then(function (buffer) {
                const blob = new Blob([buffer], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "EquipmentList_Template_" + new Date().toISOString().slice(0, 10) + ".xlsx";
                a.click();
                window.URL.revokeObjectURL(url);
            }).catch(function (error) {
                MessageBox.error("Export template failed: " + error.message);
            });
        },

        //使用宏 保留单元格样式 方案可行， 
        onExport: async function () {
            if (typeof ExcelJS === 'undefined') {
                MessageBox.error("ExcelJS library is not loaded");
                return;
            }
            
            if (typeof JSZip === 'undefined') {
                MessageBox.error("JSZip library is not loaded");
                return;
            }
        
            var oSmartTable = this.byId("equipmentSmartTable");
            if (!oSmartTable) {
                MessageBox.error("Table not found");
                return;
            }
        
            var oTable = oSmartTable.getTable();
            var aData = this._getTableData(oTable);
        
            if (aData.length === 0) {
                MessageBox.information("No data to export");
                return;
            }
        
            var sTemplatePath = sap.ui.require.toUrl("emsd/ams/template/EquipmentList_Template.xlsm");
        
            try {
                // 获取模板文件
                const response = await fetch(sTemplatePath);
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                const templateArrayBuffer = await response.arrayBuffer();
                
                // 使用JSZip加载模板
                const zip = await JSZip.loadAsync(templateArrayBuffer);
                
                // 读取工作表XML
                const sheetXml = await zip.file("xl/worksheets/sheet1.xml").async("string");
                
                // 使用XML DOM解析工作表
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(sheetXml, "text/xml");
                
                // 准备必要的XML命名空间
                const nsURI = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
                
                // 获取sheet data元素，它包含所有行
                const sheetData = xmlDoc.getElementsByTagNameNS(nsURI, "sheetData")[0];
                
                // 获取并存储所有模板行，以便我们可以复制样式
                const templateRows = Array.from(sheetData.getElementsByTagNameNS(nsURI, "row"));
                
                // 获取第二行作为模板行（假设第一行是表头）
                const templateRow = templateRows.length > 1 ? templateRows[1] : templateRows[0];
                
                // 如果我们要替换现有数据行，先删除所有数据行，仅保留表头行
                if (templateRows.length > 1) {
                    for (let i = templateRows.length - 1; i > 0; i--) {
                        sheetData.removeChild(templateRows[i]);
                    }
                }
                
                // 创建共享字符串表的映射和更新函数
                const sharedStringsXml = await zip.file("xl/sharedStrings.xml").async("string");
                const ssDoc = parser.parseFromString(sharedStringsXml, "text/xml");
                const sst = ssDoc.getElementsByTagNameNS(nsURI, "sst")[0];
                let ssCount = parseInt(sst.getAttribute("count") || "0");
                let ssUniqueCount = parseInt(sst.getAttribute("uniqueCount") || "0");
                
                // 共享字符串缓存，用于查找已存在的字符串
                let ssCache = {};
                let ssNodes = ssDoc.getElementsByTagNameNS(nsURI, "si");
                for (let i = 0; i < ssNodes.length; i++) {
                    const node = ssNodes[i];
                    const tNode = node.getElementsByTagNameNS(nsURI, "t")[0];
                    if (tNode) {
                        const textValue = tNode.textContent;
                        ssCache[textValue] = i;
                    }
                }
                
                // 添加或查找共享字符串，返回索引
                const addSharedString = (text) => {
                    if (text === undefined || text === null) return undefined;
                    
                    const textStr = String(text);
                    
                    // 检查是否已存在相同的字符串
                    if (ssCache[textStr] !== undefined) {
                        ssCount++;
                        return ssCache[textStr];
                    }
                    
                    // 创建新的共享字符串
                    const si = ssDoc.createElementNS(nsURI, "si");
                    const t = ssDoc.createElementNS(nsURI, "t");
                    t.textContent = textStr;
                    si.appendChild(t);
                    sst.appendChild(si);
                    
                    // 更新计数
                    ssCount++;
                    ssUniqueCount++;
                    
                    // 保存索引并返回
                    const index = ssUniqueCount - 1;
                    ssCache[textStr] = index;
                    return index;
                };
                
                // 从模板行中获取单元格样式信息
                const getTemplateCellStyle = (colLetter) => {
                    if (!templateRow) return null;
                    
                    // 查找模板行中指定列的单元格
                    const cells = templateRow.getElementsByTagNameNS(nsURI, "c");
                    for (let i = 0; i < cells.length; i++) {
                        const cell = cells[i];
                        const ref = cell.getAttribute("r");
                        if (ref && ref.startsWith(colLetter)) {
                            // 克隆节点以获取完整的样式信息
                            return cell.cloneNode(true);
                        }
                    }
                    return null;
                };
                
                // 更新状态列表，用于数据验证
                const statusValues = Object.keys(this._statusConfig);
                
                // 处理数据行
                aData.forEach((item, index) => {
                    // 创建新行元素，行索引从2开始（1是表头）
                    const rowEl = xmlDoc.createElementNS(nsURI, "row");
                    const rowIndex = index + 2;
                    rowEl.setAttribute("r", rowIndex.toString());
                    rowEl.setAttribute("spans", "1:7");  // 设置跨度，根据你的列数调整
                    
                    // 如果模板行有其他属性，也复制过来
                    if (templateRow) {
                        const attrs = templateRow.attributes;
                        for (let i = 0; i < attrs.length; i++) {
                            const attr = attrs[i];
                            if (attr.name !== "r") {  // 不复制行号
                                rowEl.setAttribute(attr.name, attr.value);
                            }
                        }
                    }
                    
                    // 定义列映射
                    const columnMap = {
                        'A': 'EquipmentNo',
                        'B': 'EquipmentDescription',
                        'C': 'ModelNo',
                        'D': 'ManufacturerSerialNo',
                        'E': 'UserStatus',
                        'F': 'FunctionalLocation',
                        'G': 'CostCenter'
                    };
                    
                    // 创建单元格
                    for (const [col, field] of Object.entries(columnMap)) {
                        // 获取模板单元格，包含样式信息
                        const templateCell = getTemplateCellStyle(col);
                        let cellEl;
                        
                        if (templateCell) {
                            // 克隆模板单元格以保留样式
                            cellEl = templateCell.cloneNode(true);
                            // 更新单元格引用
                            cellEl.setAttribute("r", col + rowIndex);
                            
                            // 移除现有的值节点，如果有的话
                            const vNodes = cellEl.getElementsByTagNameNS(nsURI, "v");
                            for (let i = vNodes.length - 1; i >= 0; i--) {
                                cellEl.removeChild(vNodes[i]);
                            }
                        } else {
                            // 如果没有模板单元格，创建新的
                            cellEl = xmlDoc.createElementNS(nsURI, "c");
                            cellEl.setAttribute("r", col + rowIndex);
                        }
                        
                        // 设置单元格值
                        let value = item[field] || '';
                        
                        if (value !== '') {
                            // 使用共享字符串
                            const ssIndex = addSharedString(value);
                            cellEl.setAttribute("t", "s"); // 表示共享字符串类型
                            
                            const vEl = xmlDoc.createElementNS(nsURI, "v");
                            vEl.textContent = ssIndex.toString();
                            cellEl.appendChild(vEl);
                        }
                        
                        // 特殊处理状态列的背景色
                        if (col === 'E' && item.UserStatus) {
                            // 如果状态配置中有此状态的颜色信息，则可以在这里添加样式ID引用
                            // 注意：完整实现需要修改styles.xml文件，这里只是保留了模板中的样式
                            const statusInfo = this._statusConfig[item.UserStatus];
                            if (statusInfo && statusInfo.color) {
                                // 这里只需保留从模板复制的样式，不需要额外操作
                            }
                        }
                        
                        rowEl.appendChild(cellEl);
                    }
                    
                    sheetData.appendChild(rowEl);
                });
                
                // 更新共享字符串计数
                sst.setAttribute("count", ssCount.toString());
                sst.setAttribute("uniqueCount", ssUniqueCount.toString());
                
                // 生成序列化的XML
                const serializer = new XMLSerializer();
                const updatedSheetXml = serializer.serializeToString(xmlDoc);
                const updatedSharedStringsXml = serializer.serializeToString(ssDoc);
                
                // 更新ZIP中的文件
                zip.file("xl/worksheets/sheet1.xml", updatedSheetXml);
                zip.file("xl/sharedStrings.xml", updatedSharedStringsXml);
                
                // 生成最终文件
                const blob = await zip.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12"
                });
                
                // 下载文件
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "FilledEquipmentList_" + new Date().toISOString().slice(0,10) + ".xlsm";
                a.click();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error("Excel processing error:", error);
                MessageBox.error("Failed to process Excel template: " + error.message);
            }
        },
       
        //完全生成带样式的Excel
        onExport1: function () {
            // 检查 ExcelJS 是否已加载
            if (typeof ExcelJS === 'undefined') {
                MessageBox.error("ExcelJS library is not loaded");
                return;
            }

            var oSmartTable = this.byId("equipmentSmartTable");
            if (!oSmartTable) {
                MessageBox.error("Table not found");
                return;
            }

            var oTable = oSmartTable.getTable();
            var aData = this._getTableData(oTable);

            if (aData.length === 0) {
                MessageBox.information("No data to export");
                return;
            }

            // 创建工作簿和工作表
            var workbook = new ExcelJS.Workbook();
            var worksheet = workbook.addWorksheet("Equipment List");

            // 准备状态值列表
            const statusValues = Object.keys(this._statusConfig);

            // 定义表头
            const headers = [
                "Equipment Number",
                "Equipment Description",
                "Model Number",
                "Manufacturer Serial Number",
                "User Status",
                "Functional Location",
                "Cost Center"
            ];

            // 添加表头
            worksheet.columns = [
                { header: headers[0], key: 'equipmentNo' },
                { header: headers[1], key: 'equipmentDescription' },
                { header: headers[2], key: 'modelNo' },
                { header: headers[3], key: 'manufacturerSerialNo' },
                { header: headers[4], key: 'userStatus' },
                { header: headers[5], key: 'functionalLocation' },
                { header: headers[6], key: 'costCenter' }
            ];

            // 获取表头行并加粗
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true };

            // 数据验证配置
            const dataValidation = {
                type: 'list',
                allowBlank: false,
                formulae: [`"${statusValues.join(',')}"`],
                showErrorMessage: true,
                errorStyle: 'error',
                errorTitle: 'Invalid Input',
                error: 'Please select a value from the dropdown list'
            };

            // 添加数据并应用样式和验证
            aData.forEach((item) => {
                const rowData = {
                    equipmentNo: item.EquipmentNo,
                    equipmentDescription: item.EquipmentDescription,
                    modelNo: item.ModelNo,
                    manufacturerSerialNo: item.ManufacturerSerialNo,
                    userStatus: item.UserStatus || '', // 添加默认空字符串
                    functionalLocation: item.FunctionalLocation,
                    costCenter: item.CostCenter
                };

                const row = worksheet.addRow(rowData);

                // 获取 User Status 单元格
                const statusCell = row.getCell('userStatus');

                // 应用统一的背景颜色和数据验证
                const statusInfo = this._statusConfig[item.UserStatus] ||
                    this._statusConfig[''] || // 添加默认配置
                    { color: { fgColor: { rgb: '#FFFFFF' } } }; // 如果没有配置，使用白色

                // 为所有状态单元格添加一致的样式
                statusCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: statusInfo.color.fgColor.rgb.replace('#', 'FF') }
                };

                // 为 User Status 单元格添加数据验证
                statusCell.dataValidation = dataValidation;
            });

            // 调整列宽
            worksheet.columns.forEach(column => {
                column.width = 20;
            });

            // 导出文件
            workbook.xlsx.writeBuffer().then(function (buffer) {
                const blob = new Blob([buffer], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = "EquipmentList_" + new Date().toISOString().slice(0, 10) + ".xlsx";
                a.click();
                window.URL.revokeObjectURL(url);
            }).catch(function (error) {
                MessageBox.error("Export failed: " + error.message);
            });
        },

        // 保留原有的 _getTableData 方法
        _getTableData: function (oTable) {
            var aData = [];

            if (oTable.isA("sap.m.Table")) {
                var aItems = oTable.getSelectedItems();
                aData = aItems.length > 0
                    ? aItems.map(function (item) {
                        return item.getBindingContext().getObject();
                    })
                    : oTable.getModel().getData().results || [];
            } else if (oTable.isA("sap.ui.table.Table")) {
                var aIndices = oTable.getSelectedIndices();
                aData = aIndices.length > 0
                    ? aIndices.map(function (index) {
                        return oTable.getContextByIndex(index).getObject();
                    })
                    : oTable.getModel().getData().results || [];
            }

            return aData;
        },


        onGenerateWithData: function () {
            this.onExport();
            MessageToast.show("Exported selected equipment data");
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

        onOpenMultiEdit: function (oEvent) {
            var oTable = this.byId("equipmentSmartTable");
            var aSelectedIndices = oTable.getSelectedIndices();

            if (!oTable || aSelectedIndices.length === 0) {
                MessageToast.show(this.getResourceBundle().getText("selectAtLeastOneItem"));
                return;
            }

            var aSelectedContexts = [];
            var oBinding = oTable.getBinding("items");

            if (oTable.isA("sap.ui.table.Table")) {
                var aSelectedIndices = oTable.getSelectedIndices();
                if (aSelectedIndices.length === 0) {
                    MessageToast.show(this.getResourceBundle().getText("selectAtLeastOneItem"));
                    return;
                }
                aSelectedContexts = aSelectedIndices.map(function (iIndex) {
                    return oBinding.getContexts()[iIndex];
                });
            } else if (oTable.isA("sap.m.Table")) {
                var aSelectedItems = oTable.getSelectedItems();
                if (aSelectedItems.length === 0) {
                    MessageToast.show(this.getResourceBundle().getText("selectAtLeastOneItem"));
                    return;
                }
                aSelectedContexts = aSelectedItems.map(function (oItem) {
                    return oItem.getBindingContext();
                });
            } else {
                MessageToast.show(this.getResourceBundle().getText("unsupportedTableType"));
                return;
            }

            if (!this._oMultiEditDialog) {
                Fragment.load({
                    name: "emsd.ams.Fragment.EditFragment",
                    controller: this
                }).then(function (oDialog) {
                    this._oMultiEditDialog = oDialog;
                    this.getView().addDependent(this._oMultiEditDialog);

                    // 设置模型
                    this._oMultiEditDialog.setModel(this.getView().getModel());
                    this._oMultiEditDialog.setModel(this.getView().getModel("i18n"), "i18n");

                    // 绑定第一个选中的元素作为参考
                    this._oMultiEditDialog.bindElement({
                        path: aContexts[0].getPath()
                    });

                    // 保存选中的上下文
                    this._aSelectedContexts = aContexts;

                    this._oMultiEditDialog.open();
                }.bind(this)).catch(function (oError) {
                    MessageToast.show(this.getResourceBundle().getText("errorLoadingFragment"));
                }.bind(this));
            } else {
                // 如果对话框已存在，更新绑定
                this._oMultiEditDialog.bindElement({
                    path: aContexts[0].getPath()
                });
                this._aSelectedContexts = aContexts;
                this._oMultiEditDialog.open();
            }
        },

        onSaveMultiEdit: function () {
            var oModel = this.getView().getModel();
            var oForm = this.byId("multiEditForm");
            var mChangedData = oForm.getModel().getProperty(oForm.getBindingContext().getPath());

            // 对所有选中的记录应用更改
            Promise.all(this._aSelectedContexts.map(function (oContext) {
                return new Promise(function (resolve, reject) {
                    oModel.update(oContext.getPath(), mChangedData, {
                        success: resolve,
                        error: reject
                    });
                });
            })).then(function () {
                MessageToast.show(this.getResourceBundle().getText("updateSuccess"));
                this._oMultiEditDialog.close();
            }.bind(this)).catch(function (oError) {
                MessageToast.show(this.getResourceBundle().getText("updateError"));
            }.bind(this));
        },

        onCancelMultiEdit: function () {
            this._oMultiEditDialog.close();
        },


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
                    that._oCostCenterDialog.setModel(that.getOwnerComponent().getModel("i18n"), "i18n");
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