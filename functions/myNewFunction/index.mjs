// functions/myNewFunction/index.mjs
export const handler = async (event, context) => {
  // Your function logic here
  return {
    statusCode: 200,
    body: {
      message: "2nd run again and again",
    },
  };
};
