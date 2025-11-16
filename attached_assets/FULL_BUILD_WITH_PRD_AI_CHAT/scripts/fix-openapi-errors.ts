import fs from 'fs';
import YAML from 'yaml';

// Read the OpenAPI spec
const spec = YAML.parse(fs.readFileSync('server/openapi.yml', 'utf8'));

// Helper function to add Error schema to error responses
function addErrorSchema(responses: any) {
  if (!responses) return;
  
  const errorCodes = ['400', '401', '403', '404', '409', '422', '429', '500', '502', '503'];
  
  for (const code of errorCodes) {
    if (responses[code]) {
      // If the response exists but has no content, add it
      if (!responses[code].content) {
        responses[code].content = {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        };
      } else if (responses[code].content['application/json']) {
        // If it has JSON content but no schema, add Error schema
        if (!responses[code].content['application/json'].schema) {
          responses[code].content['application/json'].schema = {
            $ref: '#/components/schemas/Error'
          };
        }
      }
    }
  }
}

// Process all paths
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods as any)) {
    if (typeof operation === 'object' && operation.responses) {
      addErrorSchema(operation.responses);
    }
  }
}

// Write the updated spec
fs.writeFileSync('server/openapi.yml', YAML.stringify(spec, { indent: 2 }));
console.log('✅ Updated OpenAPI spec with Error schemas for all error responses');
