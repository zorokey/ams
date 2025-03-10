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
    };
});