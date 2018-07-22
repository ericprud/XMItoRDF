let ShExToOwl = function (schema, options = {}) {
  const SHEXMI = 'http://www.w3.org/ns/shex-xmi#'
  const XSD = 'http://www.w3.org/2001/XMLSchema#'
  const ShEx = require('shex')

  // populate shapeHierarchy
  // !! get the shapeHierarchy from ShEx.Util
  let shapeHierarchy = makeHierarchy()
  Object.keys(schema.shapes).forEach(label => {
    let shapeExpr = ShEx.Util.skipDecl(schema.shapes[label])
    if (shapeExpr.type === 'Shape') {
      (shapeExpr.extends || []).forEach(
        superShape => shapeHierarchy.add(superShape, label)
      )
    }
  })
  Object.keys(schema.shapes).forEach(label => {
    if (!(label in shapeHierarchy.parents))
      shapeHierarchy.parents[label] = []
  })

  // compile predicate list
  let untyped = {}
  let predicates = ShEx.Util.getPredicateUsage(schema, untyped)
  //    IRI->{ uses: [label], commonType: shapeExpr }
  if ('errors' in options) {
    options.errors.untyped = untyped
  }

    function OWLXMLMarkup (ontologyIRI, prefixMap, source) {
      return {
        // only needed for section markers
        top: function () {
          return '<?xml version="1.0"?>\n' +
        '<!-- ' + source.resource + '\n' +
        '     ' + source.method + ' ' + source.timestamp + (
          source.viewLabels ? source.viewLabels.map(
            l => '\n       ' + l
          ) : ''
        ) + ' -->\n' +
        '<Ontology xmlns="http://www.w3.org/2002/07/owl#"\n' +
        '     ontologyIRI="' + ontologyIRI + '">\n' +
            prefixMap.map(
              pair => '    <Prefix name="' + pair.prefix + '" IRI="' + pair.url + '"/>'
            ).join('\n')
        },
        bottom: function () {
          return '</Ontology>\n'
        },
        startPackage: function (p) { return '    <!-- START ' + p.name + ' Package -->' },
        endPackage: function (p) { return '    <!-- END ' + p.name + ' Package -->\n\n' }
      }
    }
    function stringEscape (str) {
      return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }
    function ShExCMarkup (ontologyIRI, prefixMap, source) {
      return {
        top: function () {
          return '# ' + source.resource + '\n' +
            '# ' + source.method + ' ' + source.timestamp + (
              source.viewLabels ? source.viewLabels.map(
                l => '\n#   ' + l
              ) : ''
            ) + '\n' + prefixMap.map(
              pair => 'PREFIX ' + pair.prefix + ': <' + pair.url + '>'
            ).join('\n')
            'PREFIX shexmi: <http://www.w3.org/ns/shex-xmi#>\n' +
            'PREFIX mark: <https://github.com/commonmark/commonmark.js>\n' +
            '\n'
        },
        bottom: function () { return '' },
        definition: (label, rec) => (rec.abstract ? 'ABSTRACT ' : '') + pname(label),
        docLink: link => '// rdfs:definedBy <' + link + '>',
        packageStr: pkg => '// shexmi:package "' + stringEscape(pkg) + '"',
        aggregation: agg => '// shexmi:partonomy "' + agg + '"',
        comment: txt => '// shexmi:comment """' + stringEscape(txt) + '"""',
        reference: name => pname(name),
        constant: name => pname(name),
        property: name => pname(name),
        valueType: name => pname(name),
        valueReference: name => name === '.' ? '.' : '@' + pname(name),
        valueKind: name =>  name.toUpperCase(),
        startPackage: function (p) { return '# START ' + p.name + ' Package\n' },
        endPackage: function (p) { return '\n# END ' + p.name + ' Package\n' }
      }
    }
    function ShExHMarkup (model) {
      return {
        top: function () { return '' },
        bottom: function () { return '' },
        definition: (label, rec) => `      <section>
        <h3>${pname(label)}</h3>
        <div>
          <p>${rec.referees.length === 0 ? 'no references' : '' + rec.referees.length + ' reference' + (rec.referees.length > 1 ? 's' : '') + ':'}</p>
          ${rec.referees.length ? `<div class="left-scroll"><ul class="referees">
${rec.referees.map(r => `            <li><a>${finalReferee(r.classId).name}</a> ${r.propName}</li>\n`).join('')}
          </ul></div>` : ''}
        </div>
        <div class="example wrapper">
        <pre class="nohighlight schema shexc tryable">
${rec.isAbstract ? 'ABSTRACT ' : ''}<span class="shape-name"><dfn>${pname(label)}</dfn></span>`,
        docLink: link => `<a class="tryit" href="${link}"></a></pre>
      </div>
      </section>`,
        packageStr: pkg => '',
        aggregation: agg => '',
        comment: txt => '',
        reference: name => ref(pname(name)),
        constant: name => pOrT(pname(name)),
        property: name => pOrT(pname(name)),
        valueType: name => pOrT(pname(name)),
        valueReference: name => name === '.' ? '.' : '@' + ref(pname(name)),
        valueKind: name =>  name.toUpperCase(),
        startPackage: function (p) { return '    <section>\n      <h2>' + p.name + '</h2>\n\n' },
        endPackage: function (p) { return '\n    </section>\n' }
      }

      function finalReferee (classId) {
        while (nestInlinableStructure && inlineable(model, model.classes[classId])) {
          if (classId === model.classes[classId].referees[0].classId) {
            break
          }
          classId = model.classes[classId].referees[0].classId
        }
        return model.classes[classId]
      }

      function ref (term) {
        let i = term.indexOf(':') + 1
        return '<span class="shape-name">' + term.substr(0, i) + '<a>' + term.substr(i) + '</a></span>'
      }

      function pOrT (term) {
        let i = term.indexOf(':') + 1
        return '<span class="type">' + term.substr(0, i) + '</span><span class="constant">' + term.substr(i) + '</span>'
      }
    }

  function run (serializer, markup, nestInlinableStructure, chattyOWL) {
    let source = options.source

    let ret = [markup.top()]

    let curPackage = null
    Array().push.apply(ret, Object.keys(schema.shapes).filter(
      shapeLabel => !inlineable(shapeLabel) // !shapeLabel.startsWith('_:')
    ).map(
      shapeLabel => renderShapeExpr(shapeLabel, schema.shapes[shapeLabel], serializer, markup)
    ).concat(curPackage
             ? markup.endPackage({name: curPackage})
             : []))
    curPackage = null

    if (serializer.property) {
      // Declare properties
      Array().push.apply(ret, Object.keys(predicates).map(
        propName => serializer.property(propName, predicates[propName].commonType, markup)
      ))
    }


    // Terminate the various forms:
    if (options.append) {
      Array().push.apply(ret, [
        options.append
      ])
    }
    Array().push.apply(ret, [
      markup.bottom()
    ])
    return ret.join('\n\n')

    function renderShapeExpr (shapeLabel, shapeExpr, serializer, markup) {
      let ret = []
      let abstract = false, restricts = []
      if (shapeExpr.type === 'ShapeDecl') {
        if ('abstract' in shapeExpr) { abstract = shapeExpr.abstract }
        if ('restricts' in shapeExpr) { restricts = shapeExpr.restricts }
        shapeExpr = shapeExpr.shapeExpr
      }
      let pkg = getPackage(shapeExpr)
      if (pkg) {
        let v = pname(pkg) || pkg
        if (v !== curPackage) {
          if (curPackage) {
            ret.push(markup.endPackage({name: curPackage}))
          }
          curPackage = v
          ret.push(markup.startPackage({name: curPackage}))
        }
      }
            switch (shapeExpr.type) {
              case 'Shape':
                ret.push(serializer.class(shapeLabel, shapeExpr, markup, abstract, restricts))
                break
              case 'NodeConstraint':
                if ('values' in shapeExpr) {
                  ret.push(serializer.enum(shapeLabel, shapeExpr, markup))
                } else if ('datatype' in shapeExpr || 'nodeKind' in shapeExpr) {
                  ret.push(serializer.datatype(shapeLabel, shapeExpr, markup))
                } else {
                  throw Error('no serializer for NodeConstraint ' + JSON.stringify(shapeExpr))
                }
                break
              default:
                throw Error('need renderShapeExpr handler for ' + shapeExpr.type)
            }
      return ret.join('\n')
    }
  }

  function getPackage (shapeExpr) {
    let a = (shapeExpr.annotations || []).find(a => a.predicate === SHEXMI + 'package')
    return a ? a.object.value : null
  }

  function getComments (expr) { // shapeExpr or tripleExpr
    return (expr.annotations || []).filter(
      a => a.predicate === SHEXMI + 'comment'
    ).map(
      c => c.object.value
    )
  }

  // !! change getComment to use this
  function getAnnotations (expr, predicate) {
    // parse e.g.
    // { "type": "Annotation",
    //   "predicate": "http://www.w3.org/ns/shex-xmi#partonomy",
    //   "object": { "value": "shexmi:sharedAggregation" } }
    return (expr.annotations || []).filter(
      a => a.predicate === predicate
    ).map(
      c => c.object.value
    )
  }

    function encodeCharData (text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

  function OWLXMLSerializer (chatty) {
    let allProperty = []
    return {
      class: OWLXMLClass,
      enum: OWLXMLEnum,
      datatype: OWLXMLDatatype,
      property: OWLXMLProperty
    }

    function OWLXMLClass (label, shape, markup, abstract, restricts) {
      return []
        .concat(`    <Declaration>
        <Class abbreviatedIRI="${pname(label)}"/>
    </Declaration>` +
        (abstract ? (
          `\n    <DisjointUnion>
        <Class abbreviatedIRI="${pname(label)}"/>\n` + (shapeHierarchy.children[label] || []).filter(
            childShapeLabel => !childShapeLabel.startsWith('_:')
          ).map(
            childShapeLabel =>
              `        <Class abbreviatedIRI="${pname(childShapeLabel)}"/>\n`
          ).join('') +
          `    </DisjointUnion>`
        ) : ''))
        .concat(ShEx.Util.simpleTripleConstraints(shape).map(
          tripleConstraint => {
            let propName = tripleConstraint.predicate
            if (!('valueExpr' in tripleConstraint)) {
              let msg = `skipping ${label}\'s ${propName} with no valueExpr -- can't know if it's an object or data property`
              console.warn(msg)
              return `<!-- ${msg} -->`
            }
            let t = isObject(tripleConstraint.valueExpr) ? 'Object' : 'Data' // what if null?
            let type = ShEx.Util.getValueType(tripleConstraint.valueExpr)
            type = type.startsWith('_:') ? 'owl:Thing' : pname(type)
            let lower = parseInt(tripleConstraint.min || '0')
            let upper = tripleConstraint.max && tripleConstraint.max !== '*' ? parseInt(tripleConstraint.max) : -1
            return `    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <${t}AllValuesFrom>
            <${t}Property abbreviatedIRI="${pname(propName)}"/>
            <${isObject(tripleConstraint.valueExpr) ? "Class" : "Datatype"} abbreviatedIRI="${type}"/>
        </${t}AllValuesFrom>
    </SubClassOf>` + (chatty ? ((lower === 0 ? '' : (`\n    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <${t}MinCardinality cardinality="${lower}">
            <${t}Property abbreviatedIRI="${pname(propName)}"/>
        </${t}MinCardinality>
    </SubClassOf>`)) + (upper === -1 ? '' : (`\n    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <${t}MaxCardinality cardinality="${upper}">
            <${t}Property abbreviatedIRI="${pname(propName)}"/>
        </${t}MaxCardinality>
    </SubClassOf>`))) : '')
          }
        )).concat(

          // subclass membership
          (shape.extends || []).map(
            superClass =>
              `    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <Class abbreviatedIRI="${pname(superClass)}"/>
    </SubClassOf>`
          )
        ).concat(

          // package membership if not already covered
          (shapeHierarchy.parents[label] || []).find(
            supercl =>
              options.suppressDuplicateClasses && // if some superclass appears in the same package...
              getPackage(shape) === getPackage(ShEx.Util.skipDecl(schema.shapes[supercl]))
          )
            ? [] //       ... skip that package
            : [`    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <Class abbreviatedIRI="${pname(getPackage(shape))}_Package"/>
    </SubClassOf>`
            ]).concat(

              // shape comments
              getComments(shape).map(
            comment =>
              `    <AnnotationAssertion>
        <AnnotationProperty abbreviatedIRI="rdfs:comment"/>
        <AbbreviatedIRI>${pname(label)}</AbbreviatedIRI>
        <Literal datatypeIRI="http://www.w3.org/1999/02/22-rdf-syntax-ns#PlainLiteral">${encodeCharData(trimMarkdown(comment))}</Literal>
    </AnnotationAssertion>`
          ),
          (chatty ? ShEx.Util.simpleTripleConstraints(shape).reduce(

            // triple constraint comments
            (comments, tripleConstraint) =>
              comments.concat(getComments(tripleConstraint).map(
                comment => `    <AnnotationAssertion>
        <AnnotationProperty abbreviatedIRI="rdfs:comment"/>
        <AbbreviatedIRI>${pname(label)}</AbbreviatedIRI>
        <Literal datatypeIRI="http://www.w3.org/1999/02/22-rdf-syntax-ns#PlainLiteral">${encodeCharData(pname(tripleConstraint.predicate) + ' - ' + trimMarkdown(comment) + '\n')}</Literal>
    </AnnotationAssertion>`
              )), []
          ) : [])
            ).join('\n')
    }

    function OWLXMLEnum (label, nodeConstraint, markup) {
      let ret = [
        `    <EquivalentClasses>
        <Class abbreviatedIRI="${pname(label)}"/>
        <ObjectOneOf>`,
        nodeConstraint.values.map(
          v => `            <NamedIndividual abbreviatedIRI="${pname(v)}"/>`
        ).join('\n'),
        `        </ObjectOneOf>
    </EquivalentClasses>`]
      let pkg = nodeConstraint.annotations.find(
        a => a.predicate === SHEXMI + 'package'
      )
      if (pkg) {
        ret.push(`    <SubClassOf>
        <Class abbreviatedIRI="${pname(label)}"/>
        <Class abbreviatedIRI="${pname(pkg.object.value)}_Package"/>
    </SubClassOf>`)
      }
      return ret.join('\n')
    }

    function OWLXMLDatatype (label, nodeConstraint, markup) {
      // if (dt.name.startsWith(XSD) ||
      //     dt.name.startsWith('http://www.w3.org/XML/1998/namespace#')) {
      //   return ''
      // }
      return [].concat(
        `    <DatatypeDefinition>
        <Datatype abbreviatedIRI="${pname(label)}"/>
        <Datatype abbreviatedIRI="xsd:string"/>
    </DatatypeDefinition>`).join('\n')
    }

    function OWLXMLProperty (predicate, type, markup) {
      if (type === null) {
        let msg = `skipping ${predicate} with no common type`
        // console.warn(msg)
        return [`    <!-- ${msg} -->`]
      }
      let fakeRef = schema.shapes[type] || {type: 'NodeConstraint', datatype: type} // forge a ShapeRef
      let t = isObject(fakeRef) ? 'Object' : 'Data'
      type = type.startsWith('_:') ? 'owl:Thing' : pname(type)
      return [`    <Declaration>
        <${t}Property abbreviatedIRI="${pname(predicate)}"/>
    </Declaration>
    <${t}PropertyRange>
        <${t}Property abbreviatedIRI="${pname(predicate)}"/>
        <${isObject(fakeRef) ? "Class" : "Datatype"} abbreviatedIRI="${type}"/>
    </${t}PropertyRange>`]
    }
  }

  function inlineable (label) {
    return label.startsWith('_:') && ShEx.Util.skipDecl(schema.shapes[label]).type === 'Shape' // !! do actual test here (which will be redundant against ShEx.Util.nestShapes)
  }

  function trimMarkdown (md) {
    return md.replace(/\u001e/g, '\n').replace(/^[^ \t].*\n=+\n\n/mg, '').trim()
  }

  function ShExCSerializer (nestInlinableStructure) {
    return {
      class: ShExCClass,
      enum: ShExCEnum,
      datatype: ShExCDatatype
    }

    function ShExCClass (label, shape, markup, abstract, restricts, force = false) {
      if (!force && nestInlinableStructure && inlineable(label)) {
        return ''
      }
      return (force
              ? ''
              : markup.definition(label, shape)) +
        (shape.extends || []).map(
          name => ' EXTENDS ' + markup.reference(name)
        ).join('') +
        ' {\n' +
        ShEx.Util.simpleTripleConstraints(shape).map(
          tripleConstraint => {
            let propName = tripleConstraint.predicate
            let type = 'valueExpr' in tripleConstraint
                  ? ShEx.Util.getValueType(tripleConstraint.valueExpr)
                  : '.'
            // if (type === undefined) {
            //   console.warn(`unresolved datatype in ShExC: xmi:id="${tripleConstraint.valueExpr}" for ${label} / ${propName}`)
            //   type = '.' // replace with a ShExC wildcard to keep the schema coherent.
            // }
            let card = shexCardinality(tripleConstraint)
            let aggregations = getAnnotations(SHEXMI + 'partonomy')
            let valueStr = tripleConstraint.valueExpr.nodeKind
                  ? markup.valueKind(tripleConstraint.valueExpr.nodeKind)
                  : nestInlinableStructure && inlineable(type)
                  ? indent(ShExCClass(type, ShEx.Util.skipDecl(schema.shapes[type]), markup, false, null, true), '  ')
                  : isObject(tripleConstraint.valueExpr)
                  ? markup.valueReference(type)
                  : markup.valueType(type)
            return '  ' + markup.property(propName) + ' ' + valueStr +
              (card ? ' ' + card : '') +
              getAnnotations(tripleConstraint, SHEXMI + 'comment').map(
                comment => '\n  ' + markup.comment(comment)
              ).join('') +
              getAnnotations(tripleConstraint, SHEXMI + 'partonomy').map(
                aggregation => '\n  ' + aggregation
              ).join('') + ';\n'
          }
        ).join('') + '}' +
        (force ? '' : '\n') + // markup.docLink(docURL(classRecord.name))) +
        (force || !getPackage(shape) ? '' : markup.packageStr(getPackage(shape))) +
        (force || getAnnotations(shape, SHEXMI + 'comment').length === 0 ? '' : '\n' + markup.comment(trimMarkdown(getAnnotations(shape, SHEXMI + 'comment')[0])) + '^^mark:')

      function indent (s, lead) {
        let a = s.split(/\n/)
        return a[0].replace(/^ /, '') + '\n'
          + a.slice(1, a.length - 1).map(
            line => line.replace(/^/g, lead) + '\n'
          ).join('')
          + lead + a[a.length - 1]
      }
    }

    function ShExCEnum (label, nodeConstraint, markup) {
      return markup.definition(label, nodeConstraint) + ' [\n' + nodeConstraint.values.map(
        v => '  ' + markup.constant(v) + '\n'
      ).join('') + ']' // + '\n' + markup.docLink(docURL(label))
    }

    function ShExCDatatype (label, nodeConstraint, markup) {
      // if (label.startsWith(XSD) ||
      //     label.startsWith('http://www.w3.org/XML/1998/namespace#')) {
      //   return ''
      // }
      return markup.definition(label, nodeConstraint) + ' xsd:string' // + '\n' + markup.docLink(docURL(label))
    }

    function shexCardinality (propertyRecord) {
      let lower = parseInt(propertyRecord.lower || 0)
      let upper = propertyRecord.upper && propertyRecord.upper !== '*' ? parseInt(propertyRecord.upper) : -1
      if (lower === 1 && upper === 1) {
        return ''
      } else if (lower === 1 && upper === -1) {
        return '+'
      } else if (lower === 0 && upper === -1) {
        return '*'
      } else if (lower === 0 && upper === 1) {
        return '?'
      } else {
        return '{' + lower + ',' + (upper === -1 ? '' : upper) + '}'
      }
    }
  }

  function isObject (valueExpr) {
    let v = deref(valueExpr)
    // It's easier to say what's NOT an object:
    return !(v.type === 'NodeConstraint' &&
             (v.datatype
              || v.nodeKind === 'Literal'))
  }

  function deref (valueExpr) {
    if (!valueExpr) { throw Error('can\'t dereference null value expression') }
    return valueExpr.type === 'ShapeRef'
      ? schema.shapes[valueExpr.reference]
      : valueExpr
  }

  function pname (id) {
    if (id.startsWith('_:')) {
      return id
    }
    let pair = options.prefixMap.find(
      pair => id.startsWith(pair.url)
    )
    return pair
      ? pair.prefix + ':' + id.substr(pair.url.length)
      : null
  }

  return {
    run,
    format: {
      owl: OWLXMLSerializer,
      shex: ShExCSerializer
    },
    markup: {
      xml: OWLXMLMarkup,
      compact: ShExCMarkup,
      html: ShExHMarkup
    }
  }

  function makeHierarchy () {
    let roots = {}
    let parents = {}
    let children = {}
    let holders = {}
    return {
      add: function (parent, child) {
        if (parent in children && children[parent].indexOf(child) !== -1) {
          // already seen
          return
        }
        let target = parent in holders
          ? getNode(parent)
          : (roots[parent] = getNode(parent)) // add new parents to roots.
        let value = getNode(child)

        target[child] = value
        if (child in roots) {
          delete roots[child]
        }

        // // maintain hierarchy (direct and confusing)
        // children[parent] = children[parent].concat(child, children[child])
        // children[child].forEach(c => parents[c] = parents[c].concat(parent, parents[parent]))
        // parents[child] = parents[child].concat(parent, parents[parent])
        // parents[parent].forEach(p => children[p] = children[p].concat(child, children[child]))

        // maintain hierarchy (generic and confusing)
        updateClosure(children, parents, child, parent)
        updateClosure(parents, children, parent, child)
        function updateClosure (container, members, near, far) {
          container[far] = container[far].concat(near, container[near])
          container[near].forEach(
            n => (members[n] = members[n].concat(far, members[far]))
          )
        }

        function getNode (node) {
          if (!(node in holders)) {
            parents[node] = []
            children[node] = []
            holders[node] = {}
          }
          return holders[node]
        }
      },
      roots: roots,
      parents: parents,
      children: children
    }
  }
  makeHierarchy.test = function () {
    let t = makeHierarchy()
    t.add('B', 'C')
    t.add('C', 'D')
    t.add('F', 'G')
    t.add('E', 'F')
    t.add('D', 'E')
    t.add('A', 'B')
    t.add('G', 'H')
    console.dir(t)
  }
  function walkHierarchy (n, f, p) {
    return Object.keys(n).reduce((ret, k) => {
      return ret.concat(
        walkHierarchy(n[k], f, k),
        p ? f(k, p) : []) // outer invocation can have null parent
    }, [])
  }

}

module.exports = ShExToOwl
