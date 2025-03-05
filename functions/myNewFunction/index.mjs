// functions/myNewFunction/index.mjs
export const handler = async (event, context) => {
  // Your function logic here
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello from myNewFunction! editing it now",
    }),
  };
};
