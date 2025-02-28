sap.ui.define([
    "sap/ui/core/util/MockServer",
    "sap/base/Log"
], function (MockServer, Log) {
    "use strict";

    return {
        /**
         * 初始化模拟服务器
         */
        init: function () {
            Log.info("初始化MockServer");
            
            // 创建模拟服务器实例
            var oMockServer = new MockServer({
                rootUri: "/sap/opu/odata/sap/EMSD_AMS_SRV/"
            });
            
            // 配置延迟响应
            MockServer.config({
                autoRespond: true,
                autoRespondAfter: 0
            });
            
            // 获取元数据文件的路径
            var sMetadataPath = jQuery.sap.getModulePath("emsd.ams", "/localService/metadata.xml");
            
            try {
                // 读取元数据内容
                var sMetadataString = jQuery.sap.syncGetText(sMetadataPath).data;
                
                // 配置模拟服务器
                oMockServer.simulate(sMetadataString, {
                    sMockdataBaseUrl: jQuery.sap.getModulePath("emsd.ams", "/localService/mockdata"),
                    bGenerateMissingMockData: true
                });
                
                // 添加日志
                oMockServer.attachAfter("GET", function(oEvent) {
                    var oXhr = oEvent.getParameter("oXhr");
                    console.log("已处理的GET请求：" + oXhr.url);
                });
                
                // 启动服务器
                oMockServer.start();
                console.log("MockServer启动成功");
            } catch (oError) {
                console.error("MockServer启动失败：" + oError.message);
            }
        }
    };
});