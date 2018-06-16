/**
 */

function UmlModel (opts) {

  if (typeof UmlModel.singleton === 'object')
    return UmlModel.singleton
  const AGGREGATION_shared = 'AGGREGATION_shared'
  const AGGREGATION_composite = 'AGGREGATION_composite'

  function Model (source, packages, missingElements) {
    Object.assign(this, {
      source,
      packages,
      missingElements,
      get classes () { return ['bar', 'baz'] }
    })
  }

  function Package (id, name, elements) {
    Object.assign(this, {
      id,
      name,
      elements
    })
  }

  function Enumeration (id, name, values) {
    Object.assign(this, {
      id,
      name,
      values
    })
  }

  function Datatype (id, name) {
    Object.assign(this, {
      id,
      name
    })
  }

  function Class (id, name, properties) {
    Object.assign(this, {
      id,
      name,
      properties
    })
  }

  function Property (id, name, type, min, max, association, aggregation) {
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

  function AssociationRecord (id, name) {
    // if (name === null) {
    //   throw Error('no name for AssociationRecord ' + id)
    // }
    this.id = id
    this.name = name
  }

  function MissingElement (id) {
    Object.assign(this, {
      id
    })
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
