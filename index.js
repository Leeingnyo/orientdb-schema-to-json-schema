'use strict';
const fs = require('fs');
const process = require('process');

(async function () {

const OrientDB = require('orientjs');
const types = OrientDB.types;
const cli = new OrientDB.CLI();

const argv = await cli.parseArgv([]);

var server = OrientDB({
  host: argv.host,
  port: argv.port,
  username: argv.user,
  password: argv.password
});

var db = server.use({
  name: argv.dbname,
  username: argv.dbuser,
  password: argv.dbpassword
});

const SYSTEM_CLASSES_NAME_LIST = [ '_studio', 'Migration', 'OIdentity', 'OUser', 'ORole', 'ORestricted', 'OTriggered', 'OFunction', 'OSchedule', 'OSequence' ];
const TYPEMAP = {
  'Boolean': { type: 'boolean' },
  'Integer': { type: 'integer' },
  'Short': { type: 'integer' },
  'Long': { type: 'integer' },
  'Float': { type: 'number' },
  'Double': { type: 'number', }, // FIXME apply limitation value (maximum, minimum)
  'Datetime': { type: 'string', format: 'date-time' },
  'String': { type: 'string' },
  'Binary': { type: 'string', description: [ 'type: binary' ] },
  'Embedded': { type: 'ref', description: [ 'type: embedded' ] },
  'EmbeddedList': { type: 'array', description: [ 'type: embedded' ] },
  'EmbeddedSet': { type: 'array', description: [ 'type: embedded, set' ] },
  'EmbeddedMap': { type: 'object', description: [ 'type: embedded' ] },
  'Link': { type: 'ref' },
  'LinkList': { type: 'array' },
  'LinkSet': { type: 'array', description: [ 'type: set' ] },
  'LinkMap': { type: 'object' },
  'Byte': { type: 'integer', minimum: 0, maximum: 127 },
  'Transient': undefined,
  'Date': { type: 'string', format: 'date-time' },
  'Custom': undefined,
  'Decimal': { type: 'integer' },
  'LinkBag': undefined,
  'Any': undefined
};
const PREFIX = process.argv[2] || './schema/';
const POSTFIX = '.schema.json';
// TODO optionize POSTFIX
// prettify output JSON option
// console output option

const classList = await getUserClasses();

try { fs.mkdirSync('./schema', 0o755); } catch (err) { }
classList.map(convertClass).forEach(schema => {
  // console.log(JSON.stringify(schema) + '\n');
  fs.writeFile('./schema/' + schema.title + POSTFIX, JSON.stringify(schema), 'utf8', err => { });
});

db.close();

server.close();

async function getUserClasses() {
  var classList = await db.class.list();
  return classList.filter(cls => !SYSTEM_CLASSES_NAME_LIST.includes(cls.name));
}

function convertProp(prop, required, cls) {
  var property = Object.assign({}, TYPEMAP[types[prop.type]]);
  if (!property) return; // FIXME handle not supported properties. (adding class description?)

  if (property.type === 'ref') {
    var primitive = TYPEMAP[types[prop.linkedType]];
    if (primitive) {
      property.type = primitive.type;
      // FIXME what's this? I can't imagine this case.
    } else {
      Object.assign(property, convertRef(prop.linkedClass));
      property.type = 'object';
    }
  } else if (property.type === 'array') {
    var primitive = TYPEMAP[types[prop.linkedType]];
    if (primitive) {
      property.items = primitive;
    } else {
      property.items = convertRef(prop.linkedClass || prop.linkedType);
      property.items.type = 'object';
    }
  } else if (property.type === 'object') {
    var primitive = TYPEMAP[prop.linkedClass || prop.linkedType];
    property.patternProperties = {
      ".*": primitive || convertRef(prop.linkedClass || prop.linkedType)
    };
    property.additionalProperties = false;
  }
  property.description = property.description || [];
  if (prop.mandatory) { required.push(prop.originalName); }
  if (!prop.notNull) { property.type = [ property.type, 'null' ]; }
  if (prop.min) { property.minimum = prop.min; }
  if (prop.max) { property.maximum = prop.max; }
  if (prop.defaultValue !== null) {
    property.default = prop.defaultValue;
    property.description.push('default: ' + prop.defaultValue);
  }
  if (prop.readonly) { property.description.push('readony: true'); }
  if (prop.collate !== 'default') { property.description.push('collate: ' + prop.collate); }
  if (prop.regexp) { property.pattern = prop.regexp; }
  if (property.description.length > 0) {
    property.description = property.description.join('\n');
  } else {
    delete property.description;
  }
  return { [prop.name]: property };
}

function convertClass(cls) {
  var schema = {};
  var required = [];
  var properties = cls.properties
      .map(prop => convertProp(prop, required, schema)).filter(o => o)
      .reduce((properties, property) => { return Object.assign(properties, property); }, {});

  schema.$schema = 'http://json-schema.org/draft-07/schema#';
  schema.id = convertId(cls.name);
  schema.title = cls.name;
  if (Object.keys(schema).length > 0) {
    schema.properties = properties;
  }
  if (required.length > 0) {
    schema.required = required;
  }
  if (cls.superClasses) {
    schema.allOf = cls.superClasses.map(superClass => convertRef(superClass));
    schema.allOf.push({ properties: schema.properties });
    delete schema.properties;
  }

  return schema;
}

function convertId(className) {
  return PREFIX + className + POSTFIX;
}

function convertRef(className) {
  return { '$ref': convertId(className) };
}

})();
