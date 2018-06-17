# OrientDB Schema to JSON Schema

See [JSON Schema](http://json-schema.org/).

## How to

First, write your OrientDB credentials to orientjs.opts.
Refer to `orientjs.opts.example` or orientjs help.

```sh
npm i
node index [json schema id prefix]
```

default `json schema id prefix` is `./schema/`.

It generates json schema files to directory `schema`.

## Notice

It has many limitations.

* Some porperty types are not supported
  * Transient
  * Custom
  * LinkBag
  * Any
* Fix orientjs bug (?)
  * add `this.linkedType = config.linkedType || null;` to `./node_modules/orientjs/lib/db/class/property.js:42`

See the code, search FIXME for other limitations.

## Contributing

Thanks. Welcome.
