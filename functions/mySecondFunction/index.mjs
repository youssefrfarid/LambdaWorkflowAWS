// functions/myNewFunction/index.mjs
export const handler = async (event, context) => {
  // Your function logic here
  return {
    statusCode: 200,
    body: {
      message: "Hello from mySecondFunction! testing dev Environment",
    },
  };
};
