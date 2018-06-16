/**
 */

function UmlModel (opts) {

  if (typeof UmlModel.singleton === 'object')
    return UmlModel.singleton
  const AGGREGATION_shared = 'AGGREGATION_shared'
  const AGGREGATION_composite = 'AGGREGATION_composite'

  class Model {
    constructor (source, packages, missingElements) {
      Object.assign(this, {
        source,
        packages,
        missingElements,
        get classes () { return ['bar', 'baz'] }
      })
    }
  }

  class Packagable {
    constructor (id, name) {
      Object.assign(this, {
        id,
        name
      })
    }
  }

  class Package extends Packagable {
    constructor (id, name, elements) {
      super(id, name)
      Object.assign(this, {
        elements
      })
    }
  }

  class Enumeration extends Packagable {
    constructor (id, name, values) {
      super(id, name)
      Object.assign(this, {
        values
      })
    }
  }

  class Datatype extends Packagable {
    constructor (id, name) {
      super(id, name)
      Object.assign(this, {
      })
    }
  }

  class Class extends Packagable {
    constructor (id, name, properties) {
      super(id, name)
      Object.assign(this, {
        properties
      })
    }
  }

  class Property {
    constructor (id, name, type, min, max, association, aggregation) {
      Object.assign(this, {
        id,
        name,
        type,
        min,
        max,
        association,
        aggregation
      })
    }
  }

  function AssociationRecord (id, name) {
    // if (name === null) {
    //   throw Error('no name for AssociationRecord ' + id)
    // }
    this.id = id
    this.name = name
  }

  class MissingElement {
    constructor (id) {
      Object.assign(this, {
        id
      })
    }
  }

  return UmlModel.singleton = {
    Model,
    Property,
    Class,
    Package,
    Enumeration,
    Datatype,
    MissingElement,
//    Association,
    Aggregation: { shared: AGGREGATION_shared, composite: AGGREGATION_composite }
  }
}

module.exports = UmlModel
