/*global QUnit*/

sap.ui.define([
	"emsd/ams/controller/EquipmentList.controller"
], function (Controller) {
	"use strict";

	QUnit.module("EquipmentList Controller");

	QUnit.test("I should test the EquipmentList controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
