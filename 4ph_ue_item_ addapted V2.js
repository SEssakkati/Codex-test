/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(["N/record", "N/search", "N/query"], (record, search, query) => {
  const beforeLoad = (scriptContext) => {
    try {
      var userEventType = scriptContext.UserEventType;
      var recItem = scriptContext.newRecord;

      if ([userEventType.CREATE].includes(scriptContext.type)) {
        setDefaultValues(recItem);
      }
    } catch (e) {}
  };

  const afterSubmit = (scriptContext) => {
    try {
      var userEventType = scriptContext.UserEventType;

      if ([userEventType.CREATE, userEventType.EDIT].includes(scriptContext.type)) {
        var recItem = scriptContext.newRecord;

        if (recItem.getValue({ fieldId: "itemid" }) == "<will be generated automatically>") {
          var skuNumbers = createSKUNumber();
          record.submitFields({
            type: recItem.type,
            id: recItem.id,
            values: {
              itemid: skuNumbers["4Phones"],
              custitem_4ph_sku_obsequ: skuNumbers["Obsequ"],
            },
          });
        }

        if (recItem.getValue({ fieldId: "custitem_4ph_sku_obsequ" }) == "<will be generated automatically>") {
          var skuNumbers = createSKUObsequNumber();
          record.submitFields({
            type: recItem.type,
            id: recItem.id,
            values: {
              custitem_4ph_sku_obsequ: skuNumbers["Obsequ"],
            },
          });
        }

        // Attempt to fetch and reserve a unique EAN number
        const eanNumber = setEANNumber(recItem);

        var newRecItemSetActive = record.load({
          type: scriptContext.newRecord.type,
          id: scriptContext.newRecord.id,
        });

        const isRecordInactiveBefore = newRecItemSetActive.getValue({ fieldId: "isinactive" });

        if (isRecordInactiveBefore) {
          newRecItemSetActive.setValue({ fieldId: "isinactive", value: false });
        }

        newRecItemSetActive.save({ ignoreMandatoryFields: true, enableSourcing: true });

        const recordId = recItem.id;
        if (skuNumbers) {
          updateSKUNumberRecords(recordId, skuNumbers);
        } else {
          log.audit(
            "afterSubmit::warning",
            "No SKU numbers were generated during the event"
          );
        }
        if (eanNumber) {
          assignItemToEANNumber(recordId, eanNumber);
        }

        const newRecItemSetInactive = record.load({
          type: scriptContext.newRecord.type,
          id: scriptContext.newRecord.id,
        });

        const isRecordInactive = newRecItemSetInactive.getValue({ fieldId: "isinactive" });

        if (isRecordInactiveBefore) {
          newRecItemSetInactive.setValue({ fieldId: "isinactive", value: true });
        }

        newRecItemSetInactive.save({ ignoreMandatoryFields: true, enableSourcing: true });
      }
    } catch (e) {
      log.error("Error::afterSubmit", e);
    }
  };

  function setEANNumber(recItem) {
    var populateEANNumber = recItem.getValue({ fieldId: "custitem_4ph_pop_ean_autom" });
    var eanNumber = recItem.getValue({ fieldId: "upccode" });

    if (populateEANNumber && !eanNumber) {
      var objEANNumber = getAndReserveUniqueEAN();
      if (objEANNumber) {
        record.submitFields({
          type: recItem.type,
          id: recItem.id,
          values: { upccode: objEANNumber.eanNumber },
        });
        return objEANNumber.eanNumber;
      }
    }
  }

  function getAndReserveUniqueEAN() {
    // Pull top 10 unused EANs and attempt to reserve one uniquely
    const eanSearch = search.create({
      type: "customrecord_4ph_ean_numbers",
      filters: [
        ["name", "isnotempty", ""],
        "AND",
        ["custrecord_4ph_item", "anyof", "@NONE@"],
      ],
      columns: [search.createColumn({ name: "name", sort: search.Sort.ASC })],
    });

    const results = eanSearch.run().getRange({ start: 0, end: 10 });

    for (let i = 0; i < results.length; i++) {
      const eanId = results[i].id;
      const eanCode = results[i].getValue({ name: "name" });

      try {
        // Try to reserve EAN
        record.submitFields({
          type: "customrecord_4ph_ean_numbers",
          id: eanId,
          values: { custrecord_4ph_item: "-1" },
          options: { enableSourcing: false, ignoreMandatoryFields: true },
        });

        // If successful, return the reserved EAN
        return { id: eanId, eanNumber: eanCode };
      } catch (e) {
        // If submitFields fails, likely due to concurrency. Try next.
        continue;
      }
    }

    // If all 10 fail
    log.error("EAN Reservation Failed", "Could not reserve unique EAN");
    return null;
  }

  function assignItemToEANNumber(itemId, eanNumber) {
    try {
      if (!eanNumber) return;
      const result = search.create({
        type: "customrecord_4ph_ean_numbers",
        filters: [["name", "is", eanNumber]],
        columns: ["internalid"],
      })
        .run()
        .getRange({ start: 0, end: 1 });

      if (result.length > 0) {
        record.submitFields({
          type: "customrecord_4ph_ean_numbers",
          id: result[0].id,
          values: { custrecord_4ph_item: itemId },
        });
      }
    } catch (e) {
      log.error("Error::assignItemToEANNumber", e);
    }
  }

  function setDefaultValues(recItem) {
    recItem.setValue({ fieldId: "itemid", value: "<will be generated automatically>" });
    recItem.setValue({ fieldId: "custitem_4ph_sku_obsequ", value: "<will be generated automatically>" });
  }

  const createSKUNumber = () => {
    const nameMap = { customrecord_4ph_auto_sku_number_4ph: "4Phones" };
    const skuNumbers = {};
    ["customrecord_4ph_auto_sku_number_4ph"].forEach((recType) => {
      const rec = record.create({ type: recType });
      const recId = rec.save({ enableSourcing: true, ignoreMandatoryFields: true });
      skuNumbers[nameMap[recType]] = search.lookupFields({ type: recType, id: recId, columns: ["name"] }).name;
    });
    return skuNumbers;
  };

  const createSKUObsequNumber = () => {
    const nameMap = { customrecord_4ph_auto_sku_number_obs: "Obsequ" };
    const skuNumbers = {};
    ["customrecord_4ph_auto_sku_number_obs"].forEach((recType) => {
      const rec = record.create({ type: recType });
      const recId = rec.save({ enableSourcing: true, ignoreMandatoryFields: true });
      skuNumbers[nameMap[recType]] = search.lookupFields({ type: recType, id: recId, columns: ["name"] }).name;
    });
    return skuNumbers;
  };

  const updateSKUNumberRecords = (recItemId, skuNumber) => {
    const id1 = getSKUNumberId("customrecord_4ph_auto_sku_number_4ph", skuNumber["4Phones"]);
    if (id1) {
      record.submitFields({
        type: "customrecord_4ph_auto_sku_number_4ph",
        id: id1,
        values: { custrecord_4ph_link_to_item: recItemId.toString() },
      });
    }
    const id2 = getSKUNumberId("customrecord_4ph_auto_sku_number_obs", skuNumber["Obsequ"]);
    if (id2) {
      record.submitFields({
        type: "customrecord_4ph_auto_sku_number_obs",
        id: id2,
        values: { custrecord_4ph_link_to_item_obs: recItemId.toString() },
      });
    }
  };

  const getSKUNumberId = (recordType, skuNumber) => {
    const sqlQuery = query.runSuiteQL({ query: `SELECT id FROM ${recordType} WHERE name = '${skuNumber}'` });
    const results = sqlQuery.asMappedResults();
    return results.length > 0 ? results[0].id : null;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      beforeLoad,
      afterSubmit,
      assignItemToEANNumber,
      setEANNumber,
      getAndReserveUniqueEAN,
    };
  }
  return { beforeLoad, afterSubmit };
});
