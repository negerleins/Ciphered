README
Adding Endpoints Using the Server Class
The Server class is designed to streamline the process of adding HTTP endpoints to your application. This guide will help you understand how to add new endpoints using this class.

Overview
The Server class uses a private object #bindEndpoints to store endpoint definitions, organized by HTTP methods (get, post, etc.). Each endpoint is defined with a specific path and a handler function that contains the logic for that endpoint.

Steps to Add a New Endpoint
1. Locate the #bindEndpoints Object
In the Server class, find the #bindEndpoints private object where existing endpoints are defined:

javascript
Copy code
#bindEndpoints = {
  get: {
    // Existing GET endpoints
  },
  post: {
    // Existing POST endpoints
  },
  // Other HTTP methods
};
2. Choose the HTTP Method
Decide which HTTP method your new endpoint will use (get, post, put, delete, etc.).

3. Add the Endpoint Path and Handler
Under the chosen HTTP method, add a new entry with the endpoint path as the key and the handler function as the value:

javascript
Copy code
#bindEndpoints = {
  post: {
    // Existing POST endpoints
    "/your-endpoint": (req, res) => {
      // Your handler logic here
    },
  },
  // Other HTTP methods
};
4. Implement the Handler Logic
Inside the handler function, implement the logic you want to execute when the endpoint is called. You can access the request (req) and response (res) objects to handle incoming data and send responses.

javascript
Copy code
"/your-endpoint": (req, res) => {
  // Process the request data
  const data = req.body;

  // Implement your logic
  // ...

  // Send a response
  res.status(200).send({
    message: "Your custom response",
  });
},
5. (Optional) Add Validation Schema
If your endpoint requires specific data, you can define a Joi validation schema to validate incoming requests:

javascript
Copy code
// Define the schema
const yourSchema = Joi.object({
  field1: Joi.string().required(),
  field2: Joi.number().optional(),
});

// Use the schema in your handler
"/your-endpoint": (req, res) => {
  const { error, value } = yourSchema.validate(req.body);

  if (error) {
    return res.status(400).send({
      error: "Invalid request",
      details: error.details[0].message,
    });
  }

  // Proceed with validated data
  const { field1, field2 } = value;

  // Your logic here
  // ...

  res.status(200).send({
    message: "Your custom response",
  });
},
6. Bind the New Endpoint
Ensure that the bind() method is called to bind all endpoints to the Express application:

javascript
Copy code
bind() {
  for (const method in this.#bindEndpoints) {
    for (const path in this.#bindEndpoints[method]) {
      app[method](path, this.#bindEndpoints[method][path]);
    }
  }
}
Instantiate the Server class and call the bind() method:

javascript
Copy code
const server = new Server();
server.bind();
Example: Adding a New GET Endpoint
Let's add a new GET endpoint at /status to check the server status.

1. Add the Endpoint
javascript
Copy code
#bindEndpoints = {
  get: {
    "/": (_, res) => {
      return res.status(200).send({
        response: "We are online!",
      });
    },
    "/status": (req, res) => {
      res.status(200).send({
        status: "Server is running smoothly",
      });
    },
  },
  // Other HTTP methods
};
2. Bind the Endpoint
javascript
Copy code
const server = new Server();
server.bind();
Now, when you make a GET request to /status, it will return the server status.

Notes
Private Fields: The #bindEndpoints object uses private class field syntax. Ensure your Node.js version supports this feature (Node.js 12+).
Express App: The app object represents your Express application. Make sure it's properly initialized and imported where the Server class is defined.
Error Handling: Consistently handle errors by sending meaningful responses, as shown in existing handlers.
Middleware: If you need to add middleware to specific endpoints, you might need to modify the bind() method to accommodate that.
Conclusion
By following these steps, you can easily add new endpoints to your server using the Server class. This approach keeps your endpoint definitions organized and makes your codebase more maintainable.