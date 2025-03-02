sap.ui.define([
    "sap/ui/core/util/MockServer",
    "sap/base/Log"
], function (MockServer, Log) {
    "use strict";

    return {
        init: function () {
            // Create mock server
            var oMockServer = new MockServer({
                rootUri: "/sap/opu/odata/sap/EMSD_AMS_SRV/"
            });

            // Configure mock server for the OData service
            var sMetadataPath = sap.ui.require.toUrl("emsd/ams/localService/metadata.xml");
            var sMockDataPath = sap.ui.require.toUrl("emsd/ams/localService/mockdata");

            // Load metadata and annotations
            oMockServer.simulate(sMetadataPath, {
                sMockdataBaseUrl: sMockDataPath,
                bGenerateMissingMockData: true
            });

            // Add annotations
            var oAnnotations = new MockServer({
                rootUri: "localService/annotations/",
                requests: [{
                    method: "GET",
                    path: new RegExp("annotations.xml"),
                    response: function (oXhr) {
                        oXhr.respondFile(200, {}, sap.ui.require.toUrl("emsd/ams/localService/annotations.xml"));
                    }
                }]
            });

            // Start mock servers
            oMockServer.start();
            oAnnotations.start();

            Log.info("Running the app with mock data");
        }
    };
});