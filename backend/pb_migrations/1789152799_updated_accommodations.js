/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3480351616")

  // add field
  collection.fields.addAt(8, new Field({
    "cascadeDelete": false,
    "collectionId": "pbc_3998141477",
    "hidden": false,
    "id": "relation2343330479",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "city_id",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "select3932077353",
    "maxSelect": 1,
    "name": "star_rating",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "3-star",
      "4-star",
      "5-star"
    ]
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "select2394296326",
    "maxSelect": 1,
    "name": "month",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ]
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "select2732002068",
    "maxSelect": 1,
    "name": "season_tier",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "Low",
      "Mid",
      "High"
    ]
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "select2316256344",
    "maxSelect": 1,
    "name": "breakfast",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "Included",
      "Not Included"
    ]
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "hidden": false,
    "id": "number4095153759",
    "max": null,
    "min": null,
    "name": "price_min",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "number3357157638",
    "max": null,
    "min": null,
    "name": "price_max",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // update field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "select614373258",
    "maxSelect": 1,
    "name": "tier",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "3-star",
      "4-star",
      "5-star"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3480351616")

  // remove field
  collection.fields.removeById("relation2343330479")

  // remove field
  collection.fields.removeById("select3932077353")

  // remove field
  collection.fields.removeById("select2394296326")

  // remove field
  collection.fields.removeById("select2732002068")

  // remove field
  collection.fields.removeById("select2316256344")

  // remove field
  collection.fields.removeById("number4095153759")

  // remove field
  collection.fields.removeById("number3357157638")

  // update field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "select614373258",
    "maxSelect": 1,
    "name": "tier",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "select",
    "values": [
      "4-star",
      "5-star"
    ]
  }))

  return app.save(collection)
})
