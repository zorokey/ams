sap.ui.define([
    "sap/m/MessageBox"
], function(MessageBox) {
    "use strict";
  
    return {
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

        onExportBlank: function () {
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

        //使用宏 保留单元格样式 方案可行， with VBA
        onExport: async function (oSmartTable) {
            if (typeof ExcelJS === 'undefined') {
                MessageBox.error("ExcelJS library is not loaded");
                return;
            }
            
            if (typeof JSZip === 'undefined') {
                MessageBox.error("JSZip library is not loaded");
                return;
            }
        
            // var oSmartTable = this.byId("equipmentSmartTable");
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
        onExportWithStyle: function (oSmartTable) {
            // 检查 ExcelJS 是否已加载
            if (typeof ExcelJS === 'undefined') {
                MessageBox.error("ExcelJS library is not loaded");
                return;
            }

            // var oSmartTable = this.byId("equipmentSmartTable");
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
        _getTableData1: function (oTable) {
            var that = this;
            var oModel = oTable.getModel();
            var sPath = "";
            
            // 获取表格绑定路径
            if (oTable.isA("sap.m.Table")) {
                sPath = oTable.getBindingInfo("items").path;
            } else if (oTable.isA("sap.ui.table.Table")) {
                sPath = oTable.getBindingInfo("rows").path;
            }
            
            // 创建一个Promise来处理数据加载
            return new Promise(function(resolve, reject) {
                // 如果是OData模型，直接从服务器获取完整数据
                if (oModel.isA("sap.ui.model.odata.v2.ODataModel")) {
                    // 显示加载指示器
                    sap.ui.core.BusyIndicator.show(0);
                    
                    // 创建获取所有数据的请求
                    oModel.read(sPath, {
                        urlParameters: {
                            "$top": 999999,  // 设置一个非常大的值来获取所有数据
                            "$skip": 0,
                            "$inlinecount": "allpages"
                        },
                        success: function(oData) {
                            sap.ui.core.BusyIndicator.hide();
                            var aAllData = oData.results || [];
                            
                            // 如果有选中行，筛选选中的数据
                            if (oTable.isA("sap.m.Table")) {
                                var aSelectedItems = oTable.getSelectedItems();
                                if (aSelectedItems.length > 0) {
                                    // 获取选中行的键
                                    var aSelectedKeys = aSelectedItems.map(function(oItem) {
                                        return oItem.getBindingContext().getProperty("__KEY") || 
                                               oItem.getBindingContext().getPath().split("(")[1].split(")")[0];
                                    });
                                    
                                    // 筛选出选中的完整数据
                                    var aSelectedData = aAllData.filter(function(oItem) {
                                        var sItemKey = oModel.getKey(oItem).split("(")[1].split(")")[0];
                                        return aSelectedKeys.indexOf(sItemKey) !== -1;
                                    });
                                    
                                    resolve(aSelectedData);
                                } else {
                                    resolve(aAllData);
                                }
                            } else if (oTable.isA("sap.ui.table.Table")) {
                                var aSelectedIndices = oTable.getSelectedIndices();
                                if (aSelectedIndices.length > 0) {
                                    // 尝试从所有数据中按索引获取
                                    // 注意：这可能不准确，如果表格有排序或筛选
                                    var aSelectedData = [];
                                    aSelectedIndices.forEach(function(iIndex) {
                                        var oContext = oTable.getContextByIndex(iIndex);
                                        if (oContext) {
                                            var sKey = oContext.getPath();
                                            // 在完整数据集中查找匹配项
                                            aAllData.forEach(function(oDataItem) {
                                                if (sKey.endsWith(oModel.getKey(oDataItem))) {
                                                    aSelectedData.push(oDataItem);
                                                }
                                            });
                                        }
                                    });
                                    
                                    resolve(aSelectedData);
                                } else {
                                    resolve(aAllData);
                                }
                            }
                        },
                        error: function(oError) {
                            sap.ui.core.BusyIndicator.hide();
                            MessageBox.error("获取数据失败: " + oError.message);
                            reject(oError);
                        }
                    });
                } else {
                    // 非OData模型，使用常规方法
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
                    
                    resolve(aData);
                }
            });
        },
        _getTableData2: function (oTable) {
            var aData = [];
            var oModel = oTable.getModel();
        
            if (oTable.isA("sap.m.Table")) {
                var aItems = oTable.getSelectedItems();
                if (aItems.length > 0) {
                    // 获取选中项的完整数据
                    aData = aItems.map(function (item) {
                        var oContext = item.getBindingContext();
                        // 确保使用完整路径获取数据对象
                        return oContext.getObject();
                    });
                } else {
                    // 如果没有选中项，获取所有数据
                    // 可以根据需要决定是否返回空数组或所有数据
                    var sPath = oTable.getBindingInfo("items").path;
                    aData = oModel.getProperty(sPath) || [];
                }
            } else if (oTable.isA("sap.ui.table.Table")) {
                var aIndices = oTable.getSelectedIndices();
                if (aIndices.length > 0) {
                    // 获取选中行的完整数据
                    aData = aIndices.map(function (index) {
                        var oContext = oTable.getContextByIndex(index);
                        // 确保使用完整路径获取数据对象
                        return oContext.getObject();
                    });
                } else {
                    // 如果没有选中行，获取所有数据
                    // 可以根据需要决定是否返回空数组或所有数据
                    var sPath = oTable.getBindingInfo("rows").path;
                    aData = oModel.getProperty(sPath) || [];
                }
            }
        
            // 如果需要，可以添加提示
            if (aData.length === 0) {
                MessageBox.information("没有选中数据可导出");
            }
        
            return aData;
        },
        //新增Test2
        onExportWithVBA2: async function (oSmartTable) {
            if (typeof ExcelJS === 'undefined') {
                MessageBox.error("ExcelJS library is not loaded");
                return;
            }
            
            if (typeof JSZip === 'undefined') {
                MessageBox.error("JSZip library is not loaded");
                return;
            }
        
            // var oSmartTable = this.byId("equipmentSmartTable");
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
                
                // 读取styles.xml，用于添加新的样式
                const stylesXml = await zip.file("xl/styles.xml").async("string");
                const stylesDoc = parser.parseFromString(stylesXml, "text/xml");
                
                // 在表头添加新列 - 测试列1和测试列2
                const headerRow = templateRows[0];
                if (headerRow) {
                    const headerCells = headerRow.getElementsByTagNameNS(nsURI, "c");
                    // 找到最后一个单元格
                    const lastCell = headerCells[headerCells.length - 1];
                    
                    // 创建新的表头单元格(H列)
                    const newHeaderCell1 = lastCell.cloneNode(true);
                    newHeaderCell1.setAttribute("r", "H1");
                    
                    // 创建新的表头单元格(I列)，用于新的测试列
                    const newHeaderCell2 = lastCell.cloneNode(true);
                    newHeaderCell2.setAttribute("r", "I1");
                    
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
                    
                    // 设置单元格的值为"TestColumn1"
                    const hVNodes = newHeaderCell1.getElementsByTagNameNS(nsURI, "v");
                    if (hVNodes.length > 0) {
                        const ssIndex = addSharedString("TestColumn1");
                        hVNodes[0].textContent = ssIndex.toString();
                    }
                    
                    // 设置单元格的值为"TestColumn2"
                    const iVNodes = newHeaderCell2.getElementsByTagNameNS(nsURI, "v");
                    if (iVNodes.length > 0) {
                        const ssIndex = addSharedString("TestColumn2");
                        iVNodes[0].textContent = ssIndex.toString();
                    }
                    
                    // 添加新的表头单元格到表头行
                    headerRow.appendChild(newHeaderCell1);
                    headerRow.appendChild(newHeaderCell2);
                    
                    // 更新spans属性以包含新列
                    const spans = headerRow.getAttribute("spans");
                    if (spans) {
                        const spanParts = spans.split(":");
                        if (spanParts.length === 2) {
                            const newEndSpan = parseInt(spanParts[1]) + 2; // 增加2列
                            headerRow.setAttribute("spans", spanParts[0] + ":" + newEndSpan);
                        }
                    }
                    
                    // 更新共享字符串XML
                    const serializer = new XMLSerializer();
                    const updatedSharedStringsXml = serializer.serializeToString(ssDoc);
                    zip.file("xl/sharedStrings.xml", updatedSharedStringsXml);
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
                
                // 查找是否存在dataValidations元素，如果不存在则创建
                let dataValidations = xmlDoc.getElementsByTagNameNS(nsURI, "dataValidations")[0];
                if (!dataValidations) {
                    dataValidations = xmlDoc.createElementNS(nsURI, "dataValidations");
                    dataValidations.setAttribute("count", "0");
                    
                    // 找到sheetData元素后插入dataValidations
                    const sheetDataParent = sheetData.parentNode;
                    // 寻找正确的插入位置（在sheetData之后）
                    let insertAfter = sheetData;
                    let nextSibling = sheetData.nextSibling;
                    while (nextSibling && nextSibling.nodeType !== 1) {
                        nextSibling = nextSibling.nextSibling;
                    }
                    if (nextSibling) {
                        sheetDataParent.insertBefore(dataValidations, nextSibling);
                    } else {
                        sheetDataParent.appendChild(dataValidations);
                    }
                }
                
                // 创建新的数据验证规则，用于I列
                const newValidation = xmlDoc.createElementNS(nsURI, "dataValidation");
                newValidation.setAttribute("type", "list");
                newValidation.setAttribute("allowBlank", "1");
                newValidation.setAttribute("showInputMessage", "1");
                newValidation.setAttribute("showErrorMessage", "1");
                newValidation.setAttribute("sqref", "I2:I1048576"); // 应用于整个I列
                
                // 创建公式元素，包含选项A、B、C
                const formula1 = xmlDoc.createElementNS(nsURI, "formula1");
                formula1.textContent = "\"A,B,C\""; // 直接内联的列表值
                newValidation.appendChild(formula1);
                
                // 添加验证规则到dataValidations
                dataValidations.appendChild(newValidation);
                
                // 更新验证规则计数
                const validationCount = parseInt(dataValidations.getAttribute("count") || "0") + 1;
                dataValidations.setAttribute("count", validationCount.toString());
                
                // 创建或查找适合的蓝色背景色样式
                // 需要检查现有的样式，或添加新的样式ID
                let blueStyleId = null;
                
                // 检查是否已有蓝色背景的样式，或者创建新样式
                const fills = stylesDoc.getElementsByTagNameNS(nsURI, "fills")[0];
                const cellXfs = stylesDoc.getElementsByTagNameNS(nsURI, "cellXfs")[0];
                
                // 创建新的fill (蓝色背景)
                const fillCount = parseInt(fills.getAttribute("count") || "0");
                const newFill = stylesDoc.createElementNS(nsURI, "fill");
                const patternFill = stylesDoc.createElementNS(nsURI, "patternFill");
                patternFill.setAttribute("patternType", "solid");
                
                const fgColor = stylesDoc.createElementNS(nsURI, "fgColor");
                fgColor.setAttribute("rgb", "FF9BC2E6"); // 淡蓝色 RGB
                
                const bgColor = stylesDoc.createElementNS(nsURI, "bgColor");
                bgColor.setAttribute("indexed", "64");
                
                patternFill.appendChild(fgColor);
                patternFill.appendChild(bgColor);
                newFill.appendChild(patternFill);
                fills.appendChild(newFill);
                
                // 更新fills计数
                fills.setAttribute("count", (fillCount + 1).toString());
                const blueFillIndex = fillCount; // 新填充的索引
                
                // 创建或查找使用此填充的单元格格式
                const xfCount = parseInt(cellXfs.getAttribute("count") || "0");
                const newXf = stylesDoc.createElementNS(nsURI, "xf");
                
                // 复制默认xf的属性
                const defaultXf = cellXfs.getElementsByTagNameNS(nsURI, "xf")[0];
                if (defaultXf) {
                    const attrs = defaultXf.attributes;
                    for (let i = 0; i < attrs.length; i++) {
                        const attr = attrs[i];
                        if (attr.name !== "fillId") {
                            newXf.setAttribute(attr.name, attr.value);
                        }
                    }
                }
                
                newXf.setAttribute("fillId", blueFillIndex.toString());
                newXf.setAttribute("applyFill", "1");
                cellXfs.appendChild(newXf);
                
                // 更新cellXfs计数
                cellXfs.setAttribute("count", (xfCount + 1).toString());
                blueStyleId = xfCount; // 新样式的ID
                
                // 处理数据行
                aData.forEach((item, index) => {
                    // 创建新行元素，行索引从2开始（1是表头）
                    const rowEl = xmlDoc.createElementNS(nsURI, "row");
                    const rowIndex = index + 2;
                    rowEl.setAttribute("r", rowIndex.toString());
                    rowEl.setAttribute("spans", "1:9");  // 更新跨度为9列
                    
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
                    
                    // 添加第一个额外的测试列 (H列) - 复制状态列(E列)的格式和值
                    // 获取E列的单元格模板
                    const statusCellTemplate = getTemplateCellStyle('E');
                    let testCell1;
                    
                    if (statusCellTemplate) {
                        // 克隆状态单元格以保留样式和数据验证
                        testCell1 = statusCellTemplate.cloneNode(true);
                        // 更新单元格引用
                        testCell1.setAttribute("r", 'H' + rowIndex);
                        
                        // 移除现有的值节点，如果有的话
                        const vNodes = testCell1.getElementsByTagNameNS(nsURI, "v");
                        for (let i = vNodes.length - 1; i >= 0; i--) {
                            testCell1.removeChild(vNodes[i]);
                        }
                    } else {
                        // 如果没有模板单元格，创建新的
                        testCell1 = xmlDoc.createElementNS(nsURI, "c");
                        testCell1.setAttribute("r", 'H' + rowIndex);
                    }
                    
                    // 为测试列设置与状态列相同的值
                    let statusValue = item.UserStatus || '';
                    
                    if (statusValue !== '') {
                        // 使用共享字符串
                        const ssIndex = addSharedString(statusValue);
                        testCell1.setAttribute("t", "s"); // 表示共享字符串类型
                        
                        const vEl = xmlDoc.createElementNS(nsURI, "v");
                        vEl.textContent = ssIndex.toString();
                        testCell1.appendChild(vEl);
                    }
                    
                    rowEl.appendChild(testCell1);
                    
                    // 添加第二个额外的测试列 (I列) - 蓝色背景，新的下拉选项
                    let testCell2 = xmlDoc.createElementNS(nsURI, "c");
                    testCell2.setAttribute("r", 'I' + rowIndex);
                    testCell2.setAttribute("s", blueStyleId.toString()); // 设置蓝色背景样式
                    
                    // 默认值设为空或者A/B/C中的一个
                    let initialValue = '';
                    // 可以根据行号循环选择A、B、C
                    const options = ['A', 'B', 'C'];
                    const optionIndex = index % options.length;
                    initialValue = options[optionIndex];
                    
                    if (initialValue !== '') {
                        // 使用共享字符串
                        const ssIndex = addSharedString(initialValue);
                        testCell2.setAttribute("t", "s"); // 表示共享字符串类型
                        
                        const vEl = xmlDoc.createElementNS(nsURI, "v");
                        vEl.textContent = ssIndex.toString();
                        testCell2.appendChild(vEl);
                    }
                    
                    rowEl.appendChild(testCell2);
                    
                    sheetData.appendChild(rowEl);
                });
                
                // 更新共享字符串计数
                sst.setAttribute("count", ssCount.toString());
                sst.setAttribute("uniqueCount", ssUniqueCount.toString());
                
                // 生成序列化的XML
                const serializer = new XMLSerializer();
                const updatedSheetXml = serializer.serializeToString(xmlDoc);
                const updatedSharedStringsXml = serializer.serializeToString(ssDoc);
                const updatedStylesXml = serializer.serializeToString(stylesDoc);
                
                // 更新ZIP中的文件
                zip.file("xl/worksheets/sheet1.xml", updatedSheetXml);
                zip.file("xl/sharedStrings.xml", updatedSharedStringsXml);
                zip.file("xl/styles.xml", updatedStylesXml);
                
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
        onExportWithVBA1: async function (oSmartTable) {
            if (typeof ExcelJS === 'undefined') {
                MessageBox.error("ExcelJS library is not loaded");
                return;
            }
            
            if (typeof JSZip === 'undefined') {
                MessageBox.error("JSZip library is not loaded");
                return;
            }
        
            // var oSmartTable = this.byId("equipmentSmartTable");
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
                
                // 在表头添加新列 - 测试列
                const headerRow = templateRows[0];
                if (headerRow) {
                    const headerCells = headerRow.getElementsByTagNameNS(nsURI, "c");
                    // 找到最后一个单元格(G列)
                    const lastCell = headerCells[headerCells.length - 1];
                    // 创建新的表头单元格(H列)
                    const newHeaderCell = lastCell.cloneNode(true);
                    // 更新单元格引用为H1
                    newHeaderCell.setAttribute("r", "H1");
                    
                    // 设置单元格的值为"TestColumn"
                    const vNodes = newHeaderCell.getElementsByTagNameNS(nsURI, "v");
                    if (vNodes.length > 0) {
                        // 获取共享字符串表
                        const sharedStringsXml = await zip.file("xl/sharedStrings.xml").async("string");
                        const ssDoc = parser.parseFromString(sharedStringsXml, "text/xml");
                        const sst = ssDoc.getElementsByTagNameNS(nsURI, "sst")[0];
                        
                        // 创建新的共享字符串
                        const si = ssDoc.createElementNS(nsURI, "si");
                        const t = ssDoc.createElementNS(nsURI, "t");
                        t.textContent = "TestColumn";
                        si.appendChild(t);
                        sst.appendChild(si);
                        
                        // 更新计数
                        let ssCount = parseInt(sst.getAttribute("count") || "0") + 1;
                        let ssUniqueCount = parseInt(sst.getAttribute("uniqueCount") || "0") + 1;
                        sst.setAttribute("count", ssCount.toString());
                        sst.setAttribute("uniqueCount", ssUniqueCount.toString());
                        
                        // 设置单元格值为新添加的共享字符串索引
                        vNodes[0].textContent = (ssUniqueCount - 1).toString();
                        
                        // 更新共享字符串XML
                        const serializer = new XMLSerializer();
                        const updatedSharedStringsXml = serializer.serializeToString(ssDoc);
                        zip.file("xl/sharedStrings.xml", updatedSharedStringsXml);
                    }
                    
                    // 添加新的表头单元格到表头行
                    headerRow.appendChild(newHeaderCell);
                    
                    // 更新spans属性以包含新列
                    const spans = headerRow.getAttribute("spans");
                    if (spans) {
                        const spanParts = spans.split(":");
                        if (spanParts.length === 2) {
                            const newEndSpan = parseInt(spanParts[1]) + 1;
                            headerRow.setAttribute("spans", spanParts[0] + ":" + newEndSpan);
                        }
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
                    rowEl.setAttribute("spans", "1:8");  // 更新跨度为8列
                    
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
                    
                    // 添加额外的测试列 (H列) - 复制状态列(E列)的格式和值
                    // 获取E列的单元格模板
                    const statusCellTemplate = getTemplateCellStyle('E');
                    let testCell;
                    
                    if (statusCellTemplate) {
                        // 克隆状态单元格以保留样式和数据验证
                        testCell = statusCellTemplate.cloneNode(true);
                        // 更新单元格引用
                        testCell.setAttribute("r", 'H' + rowIndex);
                        
                        // 移除现有的值节点，如果有的话
                        const vNodes = testCell.getElementsByTagNameNS(nsURI, "v");
                        for (let i = vNodes.length - 1; i >= 0; i--) {
                            testCell.removeChild(vNodes[i]);
                        }
                    } else {
                        // 如果没有模板单元格，创建新的
                        testCell = xmlDoc.createElementNS(nsURI, "c");
                        testCell.setAttribute("r", 'H' + rowIndex);
                        // 复制E列的样式属性
                        if (templateRow) {
                            const eCells = templateRow.getElementsByTagNameNS(nsURI, "c");
                            for (let i = 0; i < eCells.length; i++) {
                                const eCell = eCells[i];
                                const ref = eCell.getAttribute("r");
                                if (ref && ref.startsWith('E')) {
                                    const attrs = eCell.attributes;
                                    for (let j = 0; j < attrs.length; j++) {
                                        const attr = attrs[j];
                                        if (attr.name !== "r") {
                                            testCell.setAttribute(attr.name, attr.value);
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    
                    // 为测试列设置与状态列相同的值
                    let value = item.UserStatus || '';
                    
                    if (value !== '') {
                        // 使用共享字符串
                        const ssIndex = addSharedString(value);
                        testCell.setAttribute("t", "s"); // 表示共享字符串类型
                        
                        const vEl = xmlDoc.createElementNS(nsURI, "v");
                        vEl.textContent = ssIndex.toString();
                        testCell.appendChild(vEl);
                    }
                    
                    rowEl.appendChild(testCell);
                    
                    sheetData.appendChild(rowEl);
                });
                
                // 更新共享字符串计数
                sst.setAttribute("count", ssCount.toString());
                sst.setAttribute("uniqueCount", ssUniqueCount.toString());
                
                // 复制数据验证
                // 查找是否存在dataValidations元素
                let dataValidations = xmlDoc.getElementsByTagNameNS(nsURI, "dataValidations")[0];
                if (dataValidations) {
                    const validations = dataValidations.getElementsByTagNameNS(nsURI, "dataValidation");
                    for (let i = 0; i < validations.length; i++) {
                        const validation = validations[i];
                        const sqref = validation.getAttribute("sqref");
                        if (sqref && sqref.startsWith("E")) {
                            // 创建新的验证规则，复制E列的验证到H列
                            const newValidation = validation.cloneNode(true);
                            const newSqref = sqref.replace(/E(\d+)/g, "H$1");
                            newValidation.setAttribute("sqref", newSqref);
                            dataValidations.appendChild(newValidation);
                            
                            // 更新验证规则数量
                            const count = parseInt(dataValidations.getAttribute("count") || "0") + 1;
                            dataValidations.setAttribute("count", count.toString());
                        }
                    }
                }
                
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

        //从配置表获取列
        onExportWithVBA: async function (oSmartTable) {
            if (typeof ExcelJS === 'undefined') {
                MessageBox.error("ExcelJS library is not loaded");
                return;
            }
            
            if (typeof JSZip === 'undefined') {
                MessageBox.error("JSZip library is not loaded");
                return;
            }
        
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

            // var aData = await this._getTableData1(oTable);
            // if (!aData || aData.length === 0) {
            //     MessageBox.information("No data to export");
            //     return;
            // }
        
            // 从配置表获取自定义列的定义
            var aCustomColumns = await this._getCustomColumnsConfiguration();
            
            // 如果无法获取配置，给出提示但仍然继续
            if (!aCustomColumns || aCustomColumns.length === 0) {
                MessageBox.information("No custom column configuration found. Proceeding with standard export.");
                aCustomColumns = [];
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
                
                // 读取styles.xml，用于添加新的样式
                const stylesXml = await zip.file("xl/styles.xml").async("string");
                const stylesDoc = parser.parseFromString(stylesXml, "text/xml");
                
                // 读取共享字符串表
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
                
                // 获取表头行和最后一个表头单元格
                const headerRow = templateRows[0];
                let lastHeaderCell = null;
                let lastColLetter = 'G'; // 假设模板原有7列 (A-G)
                
                if (headerRow) {
                    const headerCells = headerRow.getElementsByTagNameNS(nsURI, "c");
                    lastHeaderCell = headerCells[headerCells.length - 1];
                    const lastCellRef = lastHeaderCell.getAttribute("r");
                    if (lastCellRef) {
                        lastColLetter = lastCellRef.replace(/[0-9]/g, '');
                    }
                }
                
                // 创建样式ID映射
                let styleIdMap = {};
                
                // 创建或查找指定颜色的样式ID
                const getOrCreateColorStyle = (colorHex) => {
                    // 如果已经为此颜色创建了样式，则返回缓存的ID
                    if (styleIdMap[colorHex]) {
                        return styleIdMap[colorHex];
                    }
                    
                    // 创建新的填充色
                    const fills = stylesDoc.getElementsByTagNameNS(nsURI, "fills")[0];
                    const fillCount = parseInt(fills.getAttribute("count") || "0");
                    const newFill = stylesDoc.createElementNS(nsURI, "fill");
                    const patternFill = stylesDoc.createElementNS(nsURI, "patternFill");
                    patternFill.setAttribute("patternType", "solid");
                    
                    const fgColor = stylesDoc.createElementNS(nsURI, "fgColor");
                    fgColor.setAttribute("rgb", colorHex); // 设置RGB颜色
                    
                    const bgColor = stylesDoc.createElementNS(nsURI, "bgColor");
                    bgColor.setAttribute("indexed", "64");
                    
                    patternFill.appendChild(fgColor);
                    patternFill.appendChild(bgColor);
                    newFill.appendChild(patternFill);
                    fills.appendChild(newFill);
                    
                    // 更新fills计数
                    fills.setAttribute("count", (fillCount + 1).toString());
                    const newFillIndex = fillCount; // 新填充的索引
                    
                    // 创建使用此填充的单元格格式
                    const cellXfs = stylesDoc.getElementsByTagNameNS(nsURI, "cellXfs")[0];
                    const xfCount = parseInt(cellXfs.getAttribute("count") || "0");
                    const newXf = stylesDoc.createElementNS(nsURI, "xf");
                    
                    // 复制默认xf的属性
                    const defaultXf = cellXfs.getElementsByTagNameNS(nsURI, "xf")[0];
                    if (defaultXf) {
                        const attrs = defaultXf.attributes;
                        for (let i = 0; i < attrs.length; i++) {
                            const attr = attrs[i];
                            if (attr.name !== "fillId") {
                                newXf.setAttribute(attr.name, attr.value);
                            }
                        }
                    }
                    
                    newXf.setAttribute("fillId", newFillIndex.toString());
                    newXf.setAttribute("applyFill", "1");
                    cellXfs.appendChild(newXf);
                    
                    // 更新cellXfs计数
                    cellXfs.setAttribute("count", (xfCount + 1).toString());
                    const styleId = xfCount; // 新样式的ID
                    
                    // 缓存样式ID
                    styleIdMap[colorHex] = styleId;
                    
                    return styleId;
                };
                
                // 查找或创建dataValidations元素
                let dataValidations = xmlDoc.getElementsByTagNameNS(nsURI, "dataValidations")[0];
                if (!dataValidations) {
                    dataValidations = xmlDoc.createElementNS(nsURI, "dataValidations");
                    dataValidations.setAttribute("count", "0");
                    
                    // 找到正确的插入位置（在sheetData之后）
                    const sheetDataParent = sheetData.parentNode;
                    let insertAfter = sheetData;
                    let nextSibling = sheetData.nextSibling;
                    while (nextSibling && nextSibling.nodeType !== 1) {
                        nextSibling = nextSibling.nextSibling;
                    }
                    if (nextSibling) {
                        sheetDataParent.insertBefore(dataValidations, nextSibling);
                    } else {
                        sheetDataParent.appendChild(dataValidations);
                    }
                }
                
                // 添加数据验证规则
                const addDataValidation = (colLetter, options) => {
                    if (!options || options.length === 0) return;
                    
                    // 创建新的数据验证规则
                    const newValidation = xmlDoc.createElementNS(nsURI, "dataValidation");
                    newValidation.setAttribute("type", "list");
                    newValidation.setAttribute("allowBlank", "1");
                    newValidation.setAttribute("showInputMessage", "1");
                    newValidation.setAttribute("showErrorMessage", "1");
                    newValidation.setAttribute("sqref", colLetter + "2:" + colLetter + "1048576"); // 应用于整列
                    
                    // 创建公式元素，包含选项
                    const formula1 = xmlDoc.createElementNS(nsURI, "formula1");
                    formula1.textContent = "\"" + options.join(",") + "\""; // 直接内联的列表值
                    newValidation.appendChild(formula1);
                    
                    // 添加验证规则到dataValidations
                    dataValidations.appendChild(newValidation);
                    
                    // 更新验证规则计数
                    const validationCount = parseInt(dataValidations.getAttribute("count") || "0") + 1;
                    dataValidations.setAttribute("count", validationCount.toString());
                };
                
                // 计算接下来要使用的列字母
                let nextColLetter = this._getNextColumnLetter(lastColLetter);
                
                // 添加所有配置的列到表头
                aCustomColumns.forEach((columnConfig, index) => {
                    // 当前列的字母
                    const currentColLetter = this._getColumnLetterByIndex(index + this._getColumnIndex(lastColLetter) + 1);
                    
                    // 创建表头单元格
                    const newHeaderCell = lastHeaderCell.cloneNode(true);
                    newHeaderCell.setAttribute("r", currentColLetter + "1");
                    
                    // 设置表头文本
                    const headerVNodes = newHeaderCell.getElementsByTagNameNS(nsURI, "v");
                    if (headerVNodes.length > 0) {
                        const ssIndex = addSharedString(columnConfig.title);
                        headerVNodes[0].textContent = ssIndex.toString();
                    }
                    
                    // 添加到表头行
                    headerRow.appendChild(newHeaderCell);
                    
                    // 如果列有下拉选项，添加数据验证
                    if (columnConfig.dropdownValues && columnConfig.dropdownValues.length > 0) {
                        addDataValidation(currentColLetter, columnConfig.dropdownValues);
                    }
                    
                    // 更新为下一个列字母
                    nextColLetter = this._getNextColumnLetter(currentColLetter);
                });
                
                // 更新表头行的spans属性
                if (headerRow) {
                    const spans = headerRow.getAttribute("spans");
                    if (spans) {
                        const spanParts = spans.split(":");
                        if (spanParts.length === 2) {
                            const newEndSpan = parseInt(spanParts[1]) + aCustomColumns.length;
                            headerRow.setAttribute("spans", spanParts[0] + ":" + newEndSpan);
                        }
                    }
                }
                
                // 定义原始列映射
                const columnMap = {
                    'A': 'EquipmentNo',
                    'B': 'EquipmentDescription',
                    'C': 'ModelNo',
                    'D': 'ManufacturerSerialNo',
                    'E': 'UserStatus',
                    'F': 'FunctionalLocation',
                    'G': 'CostCenter'
                };
                
                // 处理数据行
                aData.forEach((item, rowIndex) => {
                    // 创建新行元素，行索引从2开始（1是表头）
                    const rowEl = xmlDoc.createElementNS(nsURI, "row");
                    const rowNum = rowIndex + 2;
                    rowEl.setAttribute("r", rowNum.toString());
                    rowEl.setAttribute("spans", "1:" + (7 + aCustomColumns.length)); // 更新跨度包含额外的列
                    
                    // 复制模板行属性
                    if (templateRow) {
                        const attrs = templateRow.attributes;
                        for (let i = 0; i < attrs.length; i++) {
                            const attr = attrs[i];
                            if (attr.name !== "r" && attr.name !== "spans") {
                                rowEl.setAttribute(attr.name, attr.value);
                            }
                        }
                    }
                    
                    // 创建原始列的单元格
                    for (const [col, field] of Object.entries(columnMap)) {
                        // 获取模板单元格
                        const templateCell = getTemplateCellStyle(col);
                        let cellEl;
                        
                        if (templateCell) {
                            // 克隆模板单元格以保留样式
                            cellEl = templateCell.cloneNode(true);
                            cellEl.setAttribute("r", col + rowNum);
                            
                            // 移除现有的值节点
                            const vNodes = cellEl.getElementsByTagNameNS(nsURI, "v");
                            for (let i = vNodes.length - 1; i >= 0; i--) {
                                cellEl.removeChild(vNodes[i]);
                            }
                        } else {
                            // 创建新单元格
                            cellEl = xmlDoc.createElementNS(nsURI, "c");
                            cellEl.setAttribute("r", col + rowNum);
                        }
                        
                        // 设置单元格值
                        let value = item[field] || '';
                        
                        if (value !== '') {
                            const ssIndex = addSharedString(value);
                            cellEl.setAttribute("t", "s");
                            
                            const vEl = xmlDoc.createElementNS(nsURI, "v");
                            vEl.textContent = ssIndex.toString();
                            cellEl.appendChild(vEl);
                        }
                        
                        // 特殊处理状态列
                        if (col === 'E' && item.UserStatus) {
                            const statusInfo = this._statusConfig[item.UserStatus];
                            if (statusInfo && statusInfo.color) {
                                // 这里保留模板中的样式
                            }
                        }
                        
                        rowEl.appendChild(cellEl);
                    }
                    
                    // 添加所有配置的额外列
                    aCustomColumns.forEach((columnConfig, index) => {
                        const colIndex = this._getColumnIndex(lastColLetter) + 1 + index;
                        const colLetter = this._getColumnLetterByIndex(colIndex);
                        
                        // 创建新单元格
                        let cellEl = xmlDoc.createElementNS(nsURI, "c");
                        cellEl.setAttribute("r", colLetter + rowNum);
                        
                        // 应用配置的样式
                        if (columnConfig.backgroundColor) {
                            const styleId = getOrCreateColorStyle(columnConfig.backgroundColor);
                            cellEl.setAttribute("s", styleId.toString());
                        } else if (columnConfig.styleReference) {
                            // 使用参考列的样式
                            const templateCell = getTemplateCellStyle(columnConfig.styleReference);
                            if (templateCell && templateCell.hasAttribute("s")) {
                                cellEl.setAttribute("s", templateCell.getAttribute("s"));
                            }
                        }
                        
                        // 设置值
                        let cellValue = '';
                        
                        // 如果有字段映射，从数据中获取值
                        if (columnConfig.fieldMapping && item[columnConfig.fieldMapping]) {
                            cellValue = item[columnConfig.fieldMapping];
                        } 
                        // 如果有下拉值，则使用默认值或第一个选项
                        else if (columnConfig.dropdownValues && columnConfig.dropdownValues.length > 0) {
                            cellValue = columnConfig.defaultValue || columnConfig.dropdownValues[0];
                            
                            // 如果想循环选择值
                            if (columnConfig.rotateValues) {
                                cellValue = columnConfig.dropdownValues[rowIndex % columnConfig.dropdownValues.length];
                            }
                        }
                        
                        if (cellValue !== '') {
                            const ssIndex = addSharedString(cellValue);
                            cellEl.setAttribute("t", "s");
                            
                            const vEl = xmlDoc.createElementNS(nsURI, "v");
                            vEl.textContent = ssIndex.toString();
                            cellEl.appendChild(vEl);
                        }
                        
                        rowEl.appendChild(cellEl);
                    });
                    
                    sheetData.appendChild(rowEl);
                });
                
                // 更新共享字符串计数
                sst.setAttribute("count", ssCount.toString());
                sst.setAttribute("uniqueCount", ssUniqueCount.toString());
                
                // 生成序列化的XML
                const serializer = new XMLSerializer();
                const updatedSheetXml = serializer.serializeToString(xmlDoc);
                const updatedSharedStringsXml = serializer.serializeToString(ssDoc);
                const updatedStylesXml = serializer.serializeToString(stylesDoc);
                
                // 更新ZIP中的文件
                zip.file("xl/worksheets/sheet1.xml", updatedSheetXml);
                zip.file("xl/sharedStrings.xml", updatedSharedStringsXml);
                zip.file("xl/styles.xml", updatedStylesXml);
                
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
                a.download = "EquipmentList_" + new Date().toISOString().slice(0,10) + ".xlsm";
                a.click();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error("Excel processing error:", error);
                MessageBox.error("Failed to process Excel template: " + error.message);
            }
        },
        
        /**
         * 获取自定义列的配置
         * 从配置表或服务中获取自定义列定义
         * @returns {Promise<Array>} 返回自定义列配置数组
         */
        _getCustomColumnsConfiguration: async function() {
            // 这里替换为实际的获取配置的代码
            // 可以从后端服务、OData模型或本地配置中获取
            
            try {
                // 示例：从OData服务获取配置
                // var oModel = this.getView().getModel();
                // return await new Promise((resolve, reject) => {
                //     oModel.read("/CustomColumnsSet", {
                //         success: function(oData) {
                //             resolve(oData.results);
                //         },
                //         error: function(oError) {
                //             reject(oError);
                //         }
                //     });
                // });
                
                // 示例：返回静态配置（用于测试）
                return [
                    {
                        title: "Status Copy",
                        fieldMapping: "UserStatus", // 复制UserStatus列的值
                        styleReference: "E", // 使用E列(状态列)的样式
                        dropdownValues: null // 不需要下拉
                    },
                    {
                        title: "Category",
                        backgroundColor: "FF9BC2E6", // 淡蓝色背景
                        dropdownValues: ["A", "B", "C"], // 下拉选项
                        defaultValue: "A", // 默认值
                        rotateValues: true // 在A、B、C之间循环
                    },
                    {
                        title: "Priority",
                        backgroundColor: "FFFFC7CE", // 淡红色背景
                        dropdownValues: ["High", "Medium", "Low"],
                        defaultValue: "Medium"
                    },
                    {
                        title: "Comment",
                        backgroundColor: "FFE2EFDA" // 淡绿色背景
                        // 无下拉，空白单元格
                    }
                ];
            } catch (error) {
                console.error("Error loading column configuration:", error);
                return [];
            }
        },
        
        /**
         * 获取列字母索引
         * @param {string} colLetter 列字母（如 'A', 'Z', 'AA'）
         * @returns {number} 列索引（从0开始）
         */
        _getColumnIndex: function(colLetter) {
            let result = 0;
            for (let i = 0; i < colLetter.length; i++) {
                result = result * 26 + colLetter.charCodeAt(i) - 64;
            }
            return result - 1; // 返回0基索引
        },
        
        /**
         * 根据索引获取列字母
         * @param {number} index 列索引（从0开始）
         * @returns {string} 列字母
         */
        _getColumnLetterByIndex: function(index) {
            let result = '';
            index = index + 1; // 转为1基索引
            
            while (index > 0) {
                const remainder = (index - 1) % 26;
                result = String.fromCharCode(65 + remainder) + result;
                index = Math.floor((index - remainder) / 26);
            }
            
            return result;
        },
        
        /**
         * 获取下一个列字母
         * @param {string} colLetter 当前列字母
         * @returns {string} 下一个列字母
         */
        _getNextColumnLetter: function(colLetter) {
            const index = this._getColumnIndex(colLetter);
            return this._getColumnLetterByIndex(index + 1);
        },
        
        /**
         * 获取表格数据
         * @param {sap.ui.table.Table} oTable 表格实例
         * @returns {Array} 表格数据数组
         */
        // _getTableData: function(oTable) {
        //     var aItems = oTable.getItems ? oTable.getItems() : oTable.getRows();
        //     var aData = [];
            
        //     for (var i = 0; i < aItems.length; i++) {
        //         var oItem = aItems[i];
        //         var oContext = oItem.getBindingContext();
                
        //         if (oContext) {
        //             aData.push(oContext.getObject());
        //         }
        //     }
            
        //     return aData;
        // }
    };
});