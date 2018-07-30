/** UML Model
 * editing features:

 * @function{detach}: replace  all references to <this> with a reference to a new MissingElement.

 * @function{remove(X)}: delete <X>'s entry in <this>.

 * - update(X, Y): replace all uses of <X> in <this> with <Y>.
 *
 * rendering bugs:
 *   1. junky HTML -- mixes BLOCK and FLOW
 *   2. doesn't display multi-generaltional inheritance
 */

function UmlModel (modelOptions = {}, $ = null) {

  if (typeof UmlModel.singleton === 'object')
    return UmlModel.singleton
  const AGGREGATION_shared = 'AGGREGATION_shared'
  const AGGREGATION_composite = 'AGGREGATION_composite'
  const XSD = 'http://www.w3.org/2001/XMLSchema#'
  const jsonCycles = require('circular-json')

  /** render members of a Model or a Package
   */
  function renderElement (renderTitle, list, renderMember, cssClass) {
    let expandPackages = $('<img/>', { src: 'plusbox.gif' })
    let elements = $('<ul/>')
    let packages = $('<div/>').addClass('uml ' + cssClass).append(
      expandPackages,
      $('<span/>').text(cssClass).addClass('type', cssClass),
      renderTitle(this),
      $('<span/>').text(list.length).addClass('length'),
      elements
    ).addClass(COLLAPSED).on('click', evt => {
      if (packages.hasClass(COLLAPSED)) {
        elements.append(list.map(
          elt => {
            try {
              return $('<li/>').append(renderMember(elt))
            } catch (e) {
              console.warn([e, elt])
              return $('<li/>').addClass('error').append(e)
            }
          }
        ))
        packages.removeClass(COLLAPSED).addClass(EXPANDED)
        expandPackages.attr('src', 'minusbox.gif')
      } else {
        elements.empty()
        packages.removeClass(EXPANDED).addClass(COLLAPSED)
        expandPackages.attr('src', 'plusbox.gif')
      }
      return false
    })
    return packages
  }

  function objDiffs (l, r, render, seen) {
    if (l === null && r === null ||
        l instanceof Object && Object.keys(l).length === 0 && r === null ||
        r instanceof Object && Object.keys(r).length === 0 && l === null) {
      return []
    }
    if (!(l instanceof Object) || !(r instanceof Object)) {
      throw Error('invocation error: objDiffs called with non-object')
    }
    if (l.constructor === Array || r.constructor === Array) {
      throw Error('invocation error: objDiffs called with Array')
    }
    return []
      .concat(Object.keys(l).reduce(
        (acc, x) => x in r ? acc : acc.concat(render(x + ' missing in left')), []
      ))
      .concat(Object.keys(r).reduce(
        (acc, x) => x in l ? acc : acc.concat(render(x + ' missing in right')), []
      ))
      .concat(Object.keys(l).reduce(
        (acc, x) => x in r ? acc.concat(x) : acc, []
      ).reduce(
        (acc, x) => acc.concat(l[x].diffs(r[x], render, seen)), []
      ))
  }

  function hashById (list) {
    return list.reduce(
      (acc, x) => add(acc, x.id, x), {}
    )
    function add (obj, key, val) {
      if (key in obj) {
        throw Error('key ' + key + ' already in ' + obj)
      }
      let ret = Object.assign({}, obj)
      ret[key] = val
      return ret
    }
  }

  function revisiting (seen, l, r) {
    // console.warn(seen.length ? seen[seen.length - 2].id : 'top', l.id)
    if (seen.indexOf(l) !== -1 ) {
      return true
    } else {
      seen.push(l)
      seen.push(r)
      return false
    }
  }

  function testRTTI (topic, l, r, render) {
    return l.rtti === r.rtti
      ? []
      : [render(topic + ' rtti ' + l.rtti + ' != ' + r.rtti)]
  }

  function compareList (topic, l, r, render) {
    let ret = []
    for (let i = 0; i < l.length || i < r.length; ++i) {
      if (l[i] !== r[i]) {
        ret.push(render(topic + '\'s' + i + 'th entry is ' + l[i] + ' not ' + r[i]))
      }
    }
    return ret
  }

  const COLLAPSED = 'collapsed', EXPANDED = 'expanded'

  class Model {
    constructor (id, name, source, elements, missingElements) {
      Object.assign(this, {
        get rtti () { return 'Model' },
        id,
        name,
        source,
        elements,
        missingElements,
        // getClasses: function () {
        //   return elements.reduce(
        //     (acc, pkg) => acc.concat(pkg.list('Class')), []
        //   )
        // }
        getClasses: function () {
          return this.elements.reduce(
            (acc, pkg) => acc.concat(pkg.list('Class')), []
          )
        },
        getEnumerations: function () {
          return this.elements.reduce(
            (acc, pkg) => acc.concat(pkg.list('Enumeration')), []
          )
        },
        getDatatypes: function () {
          return this.elements.reduce(
            (acc, pkg) => acc.concat(pkg.list('Datatype')), []
          )
        },
        getProperties: function () {
          let cz = this.getClasses()
          let ret = {}
          cz.forEach(
            klass => {
              klass.properties.forEach(
                property => {
                  if (!(property.name in ret)) {
                    ret[property.name] = { uses: [] }
                  }
                  ret[property.name].uses.push({ klass, property })
                }
              )
            }
          )
          return ret
        }
      })
    }

    diffs (other, render = s => s, seen = []) {
      if (revisiting(seen, this, other)) { return [] }
      let topic = 'Model'
      return testRTTI(topic, this, other, render)
        .concat(objDiffs(hashById(this.elements), hashById(other.elements), render, seen))
        .concat(objDiffs(this.missingElements, other.missingElements, render, seen))
    }

    render () {
      let ret = $('<div/>').addClass('uml model ' + EXPANDED)
      let sourceString = [this.source.resource, this.source.method, this.source.timestamp].join(' ')
      let renderTitle = _ => [
        $('<span/>').text(this.source.resource).addClass('name'),
        ' ',
        this.source.method,
        ' ',
        this.source.timestamp
      ]
      let packages = renderElement(renderTitle, this.elements, elt => elt.render(), 'model')
      ret.append(packages)
      return ret
    }

    list (rtti) {
      return this.elements.reduce(
        (acc, elt) => {
          let add = []
          if (!rtti || elt.rtti === rtti) {
            add = add.concat([elt])
          }
          if (elt.rtti === 'Package') {
            add = add.concat(elt.list(rtti))
          }
          return acc.concat(add)
        }, []
      )
    }

    toShExJ (options = {}) {
      return {
        "@context": "http://www.w3.org/ns/shex.jsonld",
        "type": "Schema",
        "shapes": this.elements.reduce(
          (acc, pkg) => acc.concat(pkg.toShExJ([], options)), []
        )
      }
    }
  }

  class Packagable {
    constructor (id, references, name, parent, comments) {
      Object.assign(this, {
        id,
        references,
        name
      })
      if (parent) { Object.assign(this, { parent }) }
      if (comments) { Object.assign(this, { comments }) }
    }

    diffs (other, render = s => s, seen = []) {
      let topic = this.rtti + ' ' + this.id
      return testRTTI(topic, this, other, render)
        .concat(objDiffs(hashById(this.references), hashById(other.references), render, seen))
        .concat(this.name !== other.name ? [
          render(topic + ' name:' + other.name + ' doesn\'t match ' + this.name)
        ] : [])
        .concat(this.parent ? this.parent.diffs(other.parent, render, seen).map(
          d => render(topic + d)
        ) : [])
        .concat(this.comments || other.comments ? compareList(topic, this.comments, other.comments, render) : [])
    }

    remove (missingElements) {
      let from = this.references.find(ref => ref instanceof Package || ref instanceof Model) // parent.elements
      let fromIndex = from ? from.elements.indexOf(this) : -1
      if (fromIndex === -1) {
        // throw Error('detach package: ' + this.id + ' not found in parent ' + from.id)
      } else {
        from.elements.splice(fromIndex, 1)
      }
      let refIndex = from ? this.references.indexOf(from) : -1
      if (refIndex === -1) {
        // throw Error('detach package: ' + this.id + ' has no reference to parent ' + from.id)
      } else {
        this.references.splice(refIndex, 1)
      }
      this.detach(missingElements)
    }

    detach (missingElements) {
      if (this.references.length === 0) {
        // no refs so no MissingElemennt
        return
      }
      if (this.id in missingElements) {
        throw Error(this.rtti + ' ' + this.id + ' already listed in missingElements')
      }
      let missingElt = new MissingElement(this.id, this.references)
      missingElements[this.id] = missingElt
      this.references.forEach(
        ref => ref.update(this, missingElt)
      )
      if (this.references.length === 0) {
        delete missingElements[this.id]
      }
    }

    render () {
      let ret = $('<div/>').addClass('uml model ' + EXPANDED)
      ret.append('render() not implemented on: ' + Object.keys(this).join(' | '))
      return ret
    }

    renderTitle () {
      return $('<span/>').text(this.name).addClass('name')
    }
  }

  class Package extends Packagable {
    constructor (id, reference, name, elements, parent, comments) {
      // pass the same falsy reference value to Packagable
      super(id, reference ? [reference] : reference, name, parent, comments)
      Object.assign(this, {
        get rtti () { return 'Package' },
        elements
      })
    }

    diffs (other, render = s => s, seen = []) {
      if (revisiting(seen, this, other)) { return [] }
      return super.diffs(other, render, seen)
        .concat(objDiffs(hashById(this.elements), hashById(other.elements), render, seen))
    }

    update (from, to) {
      let idx = this.elements.indexOf(from)
      if (idx === -1) {
        throw Error('update package: ' + from.id + ' not found in elements')
      }
      this.elements[idx] = to
    }

    remove (missingElements/*, rtti*/) {
      this.elements.forEach(
        doomed => {
          let idx = doomed.references.indexOf(this)
          if (idx === -1) {
            // throw Error('detach package: ' + this.id + ' not found in references of child ' + doomed.id)
          } else {
            doomed.references.splice(idx, 1) // detach package from references ?? redundant against Packagable.remove this.references.find(Package || Model)
          }
          doomed.remove(missingElements)
        }
      )
      super.remove(missingElements)
      /*
      let doomed = this.list(rtti)
      console.log('detach', doomed)
      this.list(rtti).forEach(
        doomed => doomed.detach(missingElements)
      )
       */
    }

    render () {
      let ret = $('<div/>').addClass('uml package ' + EXPANDED)
      let packages = renderElement(_ => this.renderTitle(), this.elements, elt => elt.render(), 'package')
      ret.append(packages)
      return ret
    }

    list (rtti) {
      return this.elements.reduce(
        (acc, elt) => {
          let add = []
          if (!rtti || elt.rtti === rtti) {
            add = add.concat([elt])
          }
          if (elt.rtti === 'Package') {
            add = add.concat(elt.list(rtti))
          }
          return acc.concat(add)
        }, []
      )
    }

    toShExJ (parents = [], options = {}) {
      return this.elements.reduce(
        (acc, elt) => acc.concat(elt.toShExJ(parents.concat(this.name), options)),
        []
      )
    }

  }

  class Enumeration extends Packagable {
    constructor (id, references, name, values, parent, comments) {
      super(id, references, name, parent, comments)
      Object.assign(this, {
        get rtti () { return 'Enumeration' },
        values
      })
    }

    diffs (other, render = s => s, seen = []) {
      if (revisiting(seen, this, other)) { return [] }
      let topic = 'Enumeration ' + this.id
      if (this.id !== other.id) {
        return [render(topic + ' doesn\'t match id ' + other.id)]
      }
      return super.diffs(other, render, seen)
        .concat(compareList(topic, this.values, other.values, render))
      // let ret = super.diffs(other, render, seen)
      // for (let i = 0; i < this.values.length && i < other.values.length; ++i) {
      //   if (this.values[i] !== other.values[i]) {
      //     ret.push(render(topic + '\'s' + i + 'th entry is ' + this.values[i] + ' not ' + other.values[i]))
      //   }
      // }
      // return ret
    }

    render () {
      let ret = $('<div/>').addClass('uml enumeration ' + EXPANDED)
      let packages = renderElement(_ => this.renderTitle(), this.values, elt => elt, 'enumeration')
      ret.append(packages)
      return ret
    }

    summarize () {
      return $('<span/>').addClass('uml enumeration').append(
        $('<span/>').text('enumeration').addClass('type enumeration'),
        $('<span/>').text(this.name).addClass('name'),
        $('<span/>').text(this.values.length).addClass('length')
      )
    }

    toShExJ (parents = [], options = {}) {
      let ret = {
        "id": options.iri(this.name, this),
        "type": "NodeConstraint",
        "values": this.values.map(
          v => options.iri(v, this)
        )
      }
      if (options.annotations) {
        let toAdd = options.annotations(this)
        if (toAdd && toAdd.length) {
          ret.annotations = toAdd
        }
      }
      return ret
    }
  }

  class Datatype extends Packagable {
    // Parent may be null for automatic datatypes generated by e.g. XSD hrefs.
    constructor (id, references, name, external, parent, comments) {
      super(id, references, name, parent, comments)
      Object.assign(this, {
        get rtti () { return 'Datatype' },
        external
      })
    }

    diffs (other, render = s => s, seen = []) {
      if (revisiting(seen, this, other)) { return [] }
      let topic = 'Datatype ' + this.id
      if (this.id !== other.id) {
        return [render(topic + ' doesn\'t match id ' + other.id)]
      }
      return super.diffs(other, render, seen)
    }

    render () {
      return $('<div/>').addClass('uml datatype ' + EXPANDED).append(
        renderElement(_ => this.renderTitle(), [], () => null, 'datatype')
      )
    }

    summarize () {
      return $('<span/>').addClass('uml datatype').append(
        $('<span/>').text('datatype').addClass('type datatype'),
        $('<span/>').text(this.name).addClass('name')
      )
    }

    toShExJ (parents = [], options = {}) {
      let ret = {
        "id": options.iri(this.name, this),
        "type": "NodeConstraint"
      }
      // Calling program encouraged to add xmlDatatype attributes.
      if (this.xmlDatatype) {
        ret.datatype = this.xmlDatatype
      } else {
        ret.nodeKind = 'Literal'
      }
      // Should they also add facets?
      if (options.annotations) {
        let toAdd = options.annotations(this)
        if (toAdd && toAdd.length) {
          ret.annotations = toAdd
        }
      }
      return ret
    }
  }

  class Class extends Packagable {
    constructor (id, references, name, generalizations, properties, isAbstract, parent, comments) {
      super(id, references, name, parent, comments)
      Object.assign(this, {
        get rtti () { return 'Class' },
        generalizations,
        properties,
        isAbstract
      })
    }

    diffs (other, render = s => s, seen = []) {
      if (revisiting(seen, this, other)) { return [] }
      let topic = 'Class ' + this.id
      if (this.id !== other.id) {
        return [render(topic + ' doesn\'t match id ' + other.id)]
      }
      return super.diffs(other, render, seen)
        .concat(objDiffs(hashById(this.generalizations),
                         hashById(other.generalizations),
                         render, seen))
        .concat(objDiffs(hashById(this.properties),
                         hashById(other.properties),
                         render, seen))
        .concat(this.aggregation !== other.aggregation ? [
          render(topic + ' aggregation:' + other.aggregation + ' doesn\'t match ' + this.aggregation)
        ] : [])
    }

    update (from, to) {
      let idx = this.generalizations.indexOf(from)
      if (idx === -1) {
        throw Error('update package: ' + from.id + ' not found in elements')
      }
      this.generalizations[idx] = to
    }

    remove (missingElements) {
      this.properties.forEach(
        prop => prop.remove(missingElements)
      )
      super.remove(missingElements)
    }

    render () {
      let ret = $('<div/>').addClass('uml class ' + EXPANDED)
      let renderTitle = _ => [
        $('<span/>').text(this.name).addClass('name')
      ].concat((this.generalizations || []).reduce(
        (acc, gen) => acc.concat([' ⊃', gen.summarize()]), []
      ))
      let packages = renderElement(renderTitle, this.properties, property => {
        return property.renderProp()
      }, 'class')
      ret.append(packages)
      return ret
    }

    summarize () {
      let expandPackages = $('<img/>', { src: 'plusbox.gif' })
      let elements = $('<ul/>')
      let packages = $('<span/>').addClass('uml class object').append(
        expandPackages,
        $('<span/>').text('class').addClass('type class'),
        $('<span/>').text(this.name).addClass('name'),
        $('<span/>').text(this.properties.length).addClass('length'),
        elements
      ).addClass(COLLAPSED).on('click', evt => {
        if (packages.hasClass(COLLAPSED)) {
          elements.append(this.properties.map(
            elt => $('<li/>').append(elt.renderProp())
          ))
          packages.removeClass(COLLAPSED).addClass(EXPANDED)
          expandPackages.attr('src', 'minusbox.gif')
        } else {
          elements.empty()
          packages.removeClass(EXPANDED).addClass(COLLAPSED)
          expandPackages.attr('src', 'plusbox.gif')
        }
        return false
      })
      return packages
    }

    toShExJ (parents = [], options = {}) {
      let shape = {
        "type": "Shape"
      }
      if (options.closedShapes) {
        shape.closed = true
      }
      if ('generalizations' in this && this.generalizations.length > 0) {
        shape.extends = this.generalizations.map(c => options.iri(c.name))
      }
      let ret = {
        "id": options.iri(this.name, this),
        "type": "ShapeDecl",
        "abstract": this.isAbstract,
        "shapeExpr": shape
      }
      if (this.properties.length > 0) {
        let conjuncts = this.properties.map(
          p => p.propToShExJ(options)
        )
        if (conjuncts.length === 1) {
          shape.expression = conjuncts[0]
        } else {
          shape.expression = {
            "type": "EachOf",
            "expressions": conjuncts
          }
        }
      }
      if (options.annotations) {
        let toAdd = options.annotations(this)
        if (toAdd && toAdd.length) {
          shape.annotations = toAdd
        }
      }
      return ret
    }
  }

  class Property {
    constructor (id, inClass, name, type, lower, upper, association, aggregation, comments) {
      Object.assign(this, {
        get rtti () { return 'Property' },
        id,
        inClass,
        name,
        type,
        lower,
        upper,
        association,
        aggregation
      })
      if (comments && comments.length) { this.comments = comments }
    }

    diffs (other, render = s => s, seen = []) {
      if (revisiting(seen, this, other)) { return [] }
      let topic = 'Property ' + this.id
      if (this.id !== other.id) {
        return [render(topic + ' doesn\'t match id ' + other.id)]
      }
      return testRTTI(topic, this, other, render)
        .concat(this.inClass.diffs(other.inClass, render, seen).map(
          d => render(topic + d)
        ))
        .concat(this.name !== other.name ? [
          render(topic + ' name:' + other.name + ' doesn\'t match ' + this.name)
        ] : [])
        // This takes forever for even a small-ish model.
        .concat(this.type.diffs(other.type, render, seen).map(
          d => render(topic + d)
        ))
        .concat(this.lower !== other.lower ? [
          render(topic + ' lower:' + other.lower + ' doesn\'t match ' + this.lower)
        ] : [])
        .concat(this.upper !== other.upper ? [
          render(topic + ' upper:' + other.upper + ' doesn\'t match ' + this.upper)
        ] : [])
        .concat(this.assocation ? this.assocation.diffs(other.assocation, render, seen).map(
          d => render(topic + d)
        ) : [])
        .concat(this.aggregation !== other.aggregation ? [
          render(topic + ' aggregation:' + other.aggregation + ' doesn\'t match ' + this.aggregation)
        ] : [])
    }

    update (from, to) {
      if (this.type !== from) {
        throw Error('update property: ' + from.id + ' not property type')
      }
      this.type = to
    }

    remove (missingElements) {
      let idx = this.type.references.indexOf(this)
      if (idx === -1) {
        throw Error('property type ' + this.type.id + ' does not list ' + this.id + ' in references')
      }
      this.type.references.splice(idx, 1) // detach prop from references.
      idx = this.inClass.properties.indexOf(this)
      if (idx === -1) {
        throw Error('Property ' + this.id + ' does not appear in Class ' + this.inClass.id)
      }
      this.inClass.properties.splice(idx, 1) // detach prop from references.
    }

    renderProp () {
      return $('<span/>').append(
        this.name,
        this.type.summarize()
      )
    }

    propToShExJ (options) {
      let valueExpr =
            this.type.rtti === 'Datatype' && this.type.external === true
            ? !modelOptions.anyURIasDataProperty && this.type.name === XSD + 'anyURI'
            ? {
                "type": "NodeConstraint",
                "nodeKind": 'iri'
              }
            : {
                "type": "NodeConstraint",
                "datatype": this.type.name
              }
            : options.iri(this.type.name, this)
      let ret = {
        "type": "TripleConstraint",
        "predicate": options.iri(this.name, this),
        "valueExpr": valueExpr
      }
      if (this.lower !== undefined) { ret.min = parseInt(this.lower) }
      if (this.upper !== undefined) { ret.max = this.upper === '*' ? -1 : parseInt(this.upper) }
      if (options.annotations) {
        let toAdd = options.annotations(this)
        if (toAdd && toAdd.length) {
          ret.annotations = toAdd
        }
      }
      return ret
    }
  }

  class Import {
    constructor (id, target, reference) {
      Object.assign(this, {
        get rtti () { return 'Import' },
        id, target, reference
      })
    }

    diffs (other, render = s => s, seen = []) {
      if (revisiting(seen, this, other)) { return [] }
      let topic = 'Import ' + this.id
      return testRTTI(topic, this, other, render)
        .concat(this.target.diffs(other.target, render, seen))
        .concat(this.reference.diffs(other.reference, render, seen))
    }

    update (from, to) {
      if (this.target !== from) {
        throw Error('update import: ' + from.id + ' not import type')
      }
      this.target = to
    }

    toShExJ (parents = [], options = {}) {
      return []
    }

    render () {
      let ret = $('<div/>').addClass('uml model ' + EXPANDED)
      ret.append(
        $('<span/>').text('import').addClass('type import'),
        '→',
        this.target.render())
      return ret
    }

  }

  class MissingElement {
    constructor (id, references = []) {
      Object.assign(this, {
        get rtti () { return 'MissingElement' },
        id,
        references
      })
    }

    diffs (other, render = s => s, seen = []) {
      if (revisiting(seen, this, other)) { return [] }
      let topic = 'MissingElement ' + this.id
      return testRTTI(topic, this, other, render)
        .concat(objDiffs(hashById(this.references),
                         hashById(other.references),
                         render, seen))
    }

    render () {
      return $('<span/>').addClass('uml missing').append(
        '☣',
        $('<span/>').text('missing').addClass('type missing'),
        $('<span/>').text(this.id).addClass('name')
      )
    }

    summarize () {
      return $('<span/>').addClass('uml missing').append(
        $('<span/>').text('missing').addClass('type missing'),
        $('<span/>').text(this.id).addClass('name')
      )
    }

    toShExJ (parents = [], options = {}) {
      console.warn('toShExJ: no definition for ' + this.id + ' referenced by ' + this.references.map(
        ref => ref.id
      ).join(', '))
      return []
    }
  }

  function fromJSON (from, options = {}) {
    if (!options.missing) {
      options.missing = (obj, key, target) => {
        throw Error(obj.id + '[' + key + '] references unknown object ' + target)
      }
    }
    let M = this
    from = JSON.parse(from)

    let objs = {}
    function makeObjs (obj) {
      if (!!obj && typeof obj !== 'string') {
        if (obj.id) {
          objs[obj.id] = new M[obj.rtti]()
        }
        Object.keys(obj).forEach(k => {
          makeObjs(obj[k])
        })
      }
    }
    makeObjs(from)

    let myMissing = { }
    function populate (obj) {
      Object.keys(obj).forEach(k => {
        let v = obj[k]
        if (!!v && typeof v !== 'string') {
          populate(v)
          if (obj.rtti === 'Property' && k === 'type' && obj.external) {
            let prop = objs[obj.id]
            if (v._idref in objs) {
              objs[v._idref].references.push(prop)
            } else {
              objs[v._idref] = new M.Datatype(v._idref, [prop], v._idref, prop, [])
            }
          }
          if (v._idref) {
            if (!(v._idref in objs)) {
              myMissing[v._idref] = objs[v._idref] = options.missing(obj, k, v._idref)
            }
            if (v._idref in myMissing) {
              myMissing[v._idref].references.push(objs[obj.id] || obj)
            }
            v = obj[k] = objs[v._idref]
          }
          if (v.id) {
            obj[k] = Object.assign(objs[v.id], v)
          }
        }
      })
    }
    populate(from)
    if (from.id) {
      from = Object.assign(objs[from.id], from)
    }

    return from

    // Below is an attempt to use a single pass in circular-json's parse callback.
    // It results in an incomplete substitution, possibly because target objects
    // get replaced before substitution.


        let needed = { }
        let known = { }
        let ret = jsonCycles.parse(from, function (key, value) {
          let references = {
            'Model': ['elements'],
            'Package': ['references', 'parent', 'elements'],
            'Import': ['target', 'reference'],
            'Property': ['type', 'inClass'],
            'Enumeration': ['references', 'parent'],
            'Datatype': ['references', 'parent'],
            'Class': ['references', 'parent', 'generalizations', 'properties']
          }
          let keys = references[this.rtti] || []
          // if (this.rtti === 'Property' && key === 'type' ||
          //     this.rtti === 'Class' && key === 'properties' ||
          //     this.rtti === 'pak1' && key === 'elements' ||
          //     this.rtti === 'Model' && key === 'elements') {
          //   console.log('this:', this, '\n', 'key:', key, '\n', 'value:', value, '\n')
          // }
          if (keys.indexOf(key) !== -1) {
            if (typeof value === 'object' && value.constructor === Array) {
              return value.map(
                (ent, idx) => resolve(value, idx, ent)
              )
            } else {
              return resolve(this, key, value)
            }
          }
          return value

          function resolve (obj, key, value) {
            let idref = value._idref
            let id = value.id
            if (idref) {
              if (idref in known) {
                value = known[idref]
              } else {
                if (!(idref in needed)) {
                  needed[idref] = []
                } else if (needed.idref.length === 0) {
                  throw Error('it seems ' + idref + ' was previously resolved')
                }
                needed[idref].push({ obj:obj, key, idref: idref })
              }
            } else {
              if (id in known) {
                throw Error('duplicate definition of ' + id)
              }
              known[id] = value
              // known[id] = Object.assign(new UmlModel[value.rtti], value)
              // Object.keys(needed).forEach(nid => {
              //   let nz = needed[nid];
              //   nz.forEach(n => {
              //     if (n.obj === value) {
              //       n.obj = known[id]
              //       // console.log(nid, n)
              //     }
              //   })
              // })
              // value = known[id]
              // if (id in needed) {
              //   needed[id].forEach(n => {
              //     n.obj[n.key] = value
              //   })
              //   // could just delete needed[id] but curious about resolutions
              //   needed[id].length = 0
              // }
            }
            return value
          }
        })
        // ret = known[ret.id] = Object.assign(new UmlModel[ret.rtti], ret)
        ret = known[ret.id] = ret
        // trim to just id=ret.id
        Object.keys(needed).forEach(id => {
          let nz = needed[id]
          if (!(id in known)) {
            throw Error('no definition for ' + id + ' needed in ' + nz.length + ' place(s)')
          }
          nz.forEach(n => {
            n.obj[n.key] = known[id]
          })
        })
        /*
        let ret = jsonCycles.parse(JSON.stringify(j), function (key, value) {
          let references = {
            'Model': ['elements'],
            'Package': ['references', 'parent', 'elements'],
            'Import': ['target', 'reference'],
            'Property': ['type', 'inClass'],
            'Enumeration': ['references', 'parent'],
            'Datatype': ['references', 'parent'],
            'Class': ['references', 'parent', 'generalizations', 'properties']
          }
          let keys = references[this.rtti] || []
          console.log('this:', this, '\n', 'key:', key, '\n', 'value:', value, '\n')
          if (keys.indexOf(key) !== -1) {
            if (typeof value === 'object' && value.constructor === Array) {
              return value.map(
                (ent, idx) => resolve(value, idx, ent)
              )
            } else {
              return resolve(this, key, value)
            }
          }
          return value

          function resolve (obj, key, value) {
            let idref = value._idref
            let id = value.id
            if (idref) {
              if (idref in known) {
                value = known[idref]
              } else {
                if (!(idref in needed)) {
                  needed[idref] = []
                } else if (needed.idref.length === 0) {
                  throw Error('it seems ' + idref + ' was previously resolved')
                }
                needed[idref].push({ obj:obj, key, idref: idref })
              }
            } else {
              if (id in known) {
                throw Error('duplicate definition of ' + id)
              }
              // known[id] = Object.assign(new UmlModel[value.rtti], value)
              known[id] = new UmlModel[value.rtti]
              Object.keys(value).forEach(k => {
                known[id][k] = value[k]
              })
              Object.keys(needed).forEach(nid => {
                let nz = needed[nid];
                nz.forEach(n => {
                  if (n.obj === value) {
                    n.obj = known[id]
                    // console.log(nid, n)
                  }
                })
              })
              value = known[id]
              if (id in needed) {
                needed[id].forEach(n => {
                  n.obj[n.key] = value
                })
                // could just delete needed[id] but curious about resolutions
                needed[id].length = 0
              }
            }
            return value
          }
        })
        ret = known[ret.id] = Object.assign(new UmlModel[ret.rtti], ret)
        // trim to just id=ret.id
        Object.keys(needed).forEach(id => {
          let nz = needed[id]
          if (!(id in known)) {
            throw Error('no definition for ' + id + ' needed in ' + nz.length + ' place(s)')
          }
          nz.forEach(n => {
            n.obj[n.key] = known[id]
          })
        })
        */
    return ret
  }

  function fromJSON999 (obj) {
    let packages = {}
    let enums = {}
    let classes = {}
    let datatypes = {}
    let associations = {}
    let imports = {}
    let missingElements = {}

    let ret = new UmlModel.Model(
      xmiGraph.source,
      null,
      missingElements
    )
    ret.elements = Object.keys(xmiGraph.packageHierarchy.roots).map(
      packageId => createPackage(packageId, ret)
    )
    return ret

    function mapElementByXmiReference (xmiRef, reference) {
      switch (xmiRef.type) {
        case 'import':
          return followImport(xmiRef.id, reference)
        case 'package':
          return createPackage(xmiRef.id, reference)
        case 'enumeration':
          return createEnumeration(xmiRef.id, reference)
        case 'datatype':
          return createDatatype(xmiRef.id, reference)
        case 'class':
          return createClass(xmiRef.id, reference)
        default:
          throw Error('mapElementByXmiReference: unknown reference type in ' + JSON.stringify(xmiRef))
      }
    }

    function followImport (importId, reference) {
      if (importId in imports) {
        throw Error('import id "' + importId + '" already used for ' + JSON.stringify(imports[importId]))
        // imports[importId].references.push(reference)
        // return imports[importId]
      }
      const importRecord = xmiGraph.imports[importId]
      // let ref = createdReferencedValueType(importRecord.idref)
      // let ret = imports[importId] = new UmlModel.Import(importId, ref)
      let ret = imports[importId] = new UmlModel.Import(importId, null, reference)
      ret.target = createdReferencedValueType(importRecord.idref, ret)
      return ret
      // imports[importId] = createdReferencedValueType(importRecord.idref)
      // imports[importId].importId = importId // write down that it's an import for round-tripping
      // return imports[importId]
    }

    function createdReferencedValueType (target, reference) {
      if (target in xmiGraph.packages) {
        return createPackage(target, reference)
      }
      if (target in xmiGraph.enums) {
        return createEnumeration(target, reference)
      }
      if (target in xmiGraph.datatypes) {
        return createDatatype(target, reference)
      }
      if (target in xmiGraph.classes) {
        return createClass(target, reference)
      }
      return missingElements[target] = createMissingElement(target, reference)
    }

    function mapElementByIdref (propertyRecord, reference) {
      if (propertyRecord.href) {
        if (propertyRecord.href in datatypes) {
          datatypes[propertyRecord.href].references.push(reference)
          return datatypes[propertyRecord.href]
        }
        return datatypes[propertyRecord.href] = new UmlModel.Datatype(propertyRecord.href, [reference], propertyRecord.href, null, propertyRecord.comments)
      }
      return createdReferencedValueType(propertyRecord.idref, reference)
    }

    function createPackage (packageId, reference) {
      if (packageId in packages) {
        throw Error('package id "' + packageId + '" already used for ' + JSON.stringify(packages[packageId]))
      }
      const packageRecord = xmiGraph.packages[packageId]
      let ret = packages[packageId] = new UmlModel.Package(packageId, reference, packageRecord.name, null, reference, packageRecord.comments)
      ret.elements = packageRecord.elements.map(
        xmiReference => mapElementByXmiReference(xmiReference, ret)
      )
      return ret
    }

    function createEnumeration (enumerationId, reference) {
      if (enumerationId in enums) {
        enums[enumerationId].references.push(reference)
        return enums[enumerationId]
      }
      const enumerationRecord = xmiGraph.enums[enumerationId]
      return enums[enumerationId] = new UmlModel.Enumeration(enumerationId, [reference], enumerationRecord.name, enumerationRecord.values, reference, enumerationRecord.comments)
    }

    function createDatatype (datatypeId, reference) {
      if (datatypeId in datatypes) {
        datatypes[datatypeId].references.push(reference)
        return datatypes[datatypeId]
      }
      const datatypeRecord = xmiGraph.datatypes[datatypeId]
      return datatypes[datatypeId] = new UmlModel.Datatype(datatypeId, [reference], datatypeRecord.name, reference, datatypeRecord.comments)
    }

    function createClass (classId, reference) {
      if (classId in classes) {
        classes[classId].references.push(reference)
        return classes[classId]
      }
      const classRecord = xmiGraph.classes[classId]
      let ret = classes[classId] = new UmlModel.Class(classId, [reference], classRecord.name, classRecord.superClasses, [], classRecord.isAbstract, reference, classRecord.comments)
      // avoid cycles like Identifiable { basedOn Identifiable }
      ret.properties = classRecord.properties.map(
        propertyRecord => createProperty(propertyRecord, ret))
      return ret
    }

    function createMissingElement (missingElementId, reference) {
      if (missingElementId in missingElements) {
        missingElements[missingElementId].references.push(reference)
        return missingElements[missingElementId]
      }
      return missingElements[missingElementId] = new UmlModel.MissingElement(missingElementId, [reference])
    }

    function createProperty (propertyRecord, inClass) {
      let ret = new UmlModel.Property(propertyRecord.id, inClass, propertyRecord.name,
                                      null, // so we can pass the Property to unresolved types
                                      propertyRecord.lower, propertyRecord.upper,
                                      propertyRecord.association,
                                      propertyRecord.aggregation,
                                      propertyRecord.comments)
      ret.type = mapElementByIdref(propertyRecord, ret)
      return ret
    }

  }

  function toJSON (term, options = { fixed: 0}) {
    return jsonCycles.stringify(term, function (key, value) {
      let references = {
        'Package': ['references', 'parent'],
        'Import': ['target', 'reference'],
        'Property': ['type', 'inClass'],
        'Enumeration': ['references', 'parent'],
        'Datatype': ['references', 'parent'],
        'Class': ['references', 'parent', 'generalizations']
      }
      let keys = references[this.rtti] || []
      if (keys.indexOf(key) !== -1) {
        if (typeof value === 'object' && value.constructor === Array) {
          return value.map(
            ent => {
              ++options.fixed
              return { _idref: ent.id } }
          )
        } else {
          ++options.fixed
          return { _idref: this[key].id }
        }
      }
      return value
    }, 2, true)
  }

  class Point {
    constructor (x, y) {
      Object.assign(this, {x, y})
    }
    foo () { return 'foo' }
    bar () { return 'bar' }
  }

  return UmlModel.singleton = {
    Model,
    Property,
    Class,
    Package,
    Enumeration,
    Datatype,
    Import,
    MissingElement,
//    Association,
    Aggregation: { shared: AGGREGATION_shared, composite: AGGREGATION_composite },
    fromJSON,
    toJSON,
    Point
  }
}

module.exports = UmlModel
