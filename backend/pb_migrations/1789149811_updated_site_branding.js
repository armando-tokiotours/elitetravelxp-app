/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1461849340")

  // add field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3589107153",
    "max": 120,
    "min": 0,
    "name": "font_h1",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1290026091",
    "max": 120,
    "min": 0,
    "name": "font_h2",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text1004735741",
    "max": 120,
    "min": 0,
    "name": "font_h3",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3408833100",
    "max": 120,
    "min": 0,
    "name": "font_body",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text42861607",
    "max": 800,
    "min": 0,
    "name": "google_fonts_import_url",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1461849340")

  // remove field
  collection.fields.removeById("text3589107153")

  // remove field
  collection.fields.removeById("text1290026091")

  // remove field
  collection.fields.removeById("text1004735741")

  // remove field
  collection.fields.removeById("text3408833100")

  // remove field
  collection.fields.removeById("text42861607")

  return app.save(collection)
})
