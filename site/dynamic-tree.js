ShExJtoAS(DDIschema)
DDIschema.prefixes = {
  ddi: 'http://ddi-alliance.org/ns/#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  shexmi: 'http://www.w3.org/ns/shex-xmi#',
  mark: 'https://github.com/commonmark/commonmark.js'
}
$('#schema').append(
  ShExHTML(window.$, marked.parse).asTree(DDIschema, 'http://ddi-alliance.org/ns/#')
)

function ShExJtoAS (schema) {
  schema.shapes = schema.shapes.reduce((acc, expr) => {
    let label = expr.id
    delete expr.id
    createRefs(expr)
    acc[label] = createRefs(expr)
    return acc

    function createRefs(object) {
      for (var key in object) {
        var item = object[key];
        if (key === 'valueExpr' && typeof item === 'string')
          object[key] = { type: 'ShapeRef', reference: item };
        else if (typeof item === 'object')
          object[key] = createRefs(item);
      }
      return object;
    }
  }, {})  
}

