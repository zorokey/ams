sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "emsd/ams/model/models",
    "emsd/ams/localService/mockserver"  // 直接在这里引入mockserver模块
], function (UIComponent, Device, models, mockserver) {  // 作为参数接收
    "use strict";

    return UIComponent.extend("emsd.ams.Component", {
        metadata: {
            manifest: "json"
        },

        /**
         * 组件初始化
         */
        init: function () {
            // 调用基类初始化
            UIComponent.prototype.init.apply(this, arguments);

            // 在开发环境中初始化模拟服务器
            if (["localhost", "127.0.0.1"].includes(window.location.hostname) ||
                window.location.hostname.includes("preview")) {
                
                // 直接使用引入的mockserver模块初始化
                mockserver.init();
            }
            
            // 设置设备模型
            this.setModel(models.createDeviceModel(), "device");

            // 创建视图模型
            this.setModel(new sap.ui.model.json.JSONModel({}), "view");

            // 启用路由
            this.getRouter().initialize();
        }
    });
});