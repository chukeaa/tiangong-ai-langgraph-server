import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

import { Annotation, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';

import SearchEduTool from 'utils/tools/search_edu_tool';
import SearchStandardTool from 'utils/tools/search_standard_tool';

import { PythonInterpreterTool } from '@langchain/community/experimental/tools/pyinterpreter';
import pyodideModule from 'pyodide';

const email = process.env.EMAIL ?? '';
const password = process.env.PASSWORD ?? '';

const openai_api_key = process.env.OPENAI_API_KEY ?? '';
const openai_chat_model = process.env.OPENAI_CHAT_MODEL ?? '';
// const openai_chat_model = 'o1-preview-2024-09-12';

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  answers: Annotation<string[]>({
    reducer: (x, y) => (y ? x.concat(y) : x),
  }),
  suggestion: Annotation<string>(),
  score: Annotation<number>(),
});

async function createPythonTool() {
  const pyodide = await pyodideModule.loadPyodide();
  if (!pyodide) {
    console.error('Failed to load Pyodide');
  } else {
    console.log('Pyodide loaded successfully');
  }
  await pyodide.loadPackage(['numpy', 'pandas', 'scipy', 'sympy']);
  const pythonTool = new PythonInterpreterTool({ instance: pyodide });
  pythonTool.description =
    'Executes Python code in a sandboxed environment and must print and return the execution results. The environment resets after each execution. The tool captures both standard output (stdout) and error output (stderr) and must print out them, ensuring any generated output or errors are available for further analysis.';
  pyodide.globals.set('console', {
    log: (msg: string) => {
      console.log('Python Output:', msg);
    },
    error: (msg: string) => {
      console.error('Python Error:', msg);
    },
  });
  return pythonTool;
}

async function loadCalculationTools() {
  const baseTools = [
    new SearchEduTool({ email, password }),
    new SearchStandardTool({ email, password }),
  ];
  const pythonTool = await createPythonTool();
  return [...baseTools, pythonTool];
}

async function calculationTool() {
  const toolsPromise = await loadCalculationTools();
  const toolNode = new ToolNode(toolsPromise);
  return toolNode;
}

const toolsPromise = loadCalculationTools();

async function callModel(state: typeof StateAnnotation.State) {
  console.log('---- callModel ----');

  const loadedTools = await toolsPromise;

  const model = new ChatOpenAI({
    apiKey: openai_api_key,
    modelName: openai_chat_model,
    streaming: false,
  }).bindTools(loadedTools);

  const response = await model.invoke([
    {
      role: 'human',
      content: `You are an environmental science expert tasked with solving a calculation-based problem. Please follow the detailed steps below to solve the given calculation problem systematically:
1. Understand the Problem:
-Read Carefully: Thoroughly read and interpret the problem statement.
-Identify Components: List all known quantities, variables, and what needs to be determined.
-Clarify Requirements: Ensure you understand what the problem is asking for.
2.Retrieve Background Information:
-Identify Relevant Concepts: Determine which mathematical concepts, formulas, or theorems are applicable.
-Review Necessary Knowledge: Briefly explain any relevant principles that will be used in solving the problem.
-Retrieve Necessary Information: Use the available search tools to gather the most authoritative information. Ensure all information is relevant, credible, and trustworthy.
3.Analyze the Problem:
-Develop a Strategy: Outline a step-by-step approach to tackle the problem.
-Break Down Complexities: Divide the problem into smaller, more manageable sub-problems if necessary.
4.Execute Calculations:
-Perform Step-by-Step Calculations: Invoke the PythonInterpreterTool tool to run the necessary code to get results and ensure the executed results should be clearly visible, with print() functions. Do not make any assumptions and do not infer parameter values. Also, do not calulate the values manually!
5.Draw Conclusions
-Explain Logic: Provide reasoning for each calculation to demonstrate understanding. Be sure to analyze the Python execution result (e.g., exact values) with supportive materials and integrate it into your final answer.
-Summarize Results: Combine the results of your calculations to answer the original question (MUST using the same language as the problem).
-Interpret the Outcome: Use the language same as the input question to explain the significance or implications of the result if applicable.
${state.suggestion !== '' ? `*** Suggestions ***  ${state.suggestion}` : ''}`,
    },
    ...state.messages,
  ]);

  return {
    messages: response,
    answers: [response.lc_kwargs.content],
  };
}

// Define the function that determines whether to continue or not
function routeModelOutput(state: typeof StateAnnotation.State) {
  console.log('------ routeModelOutput ------');
  const messages = state.messages;
  const lastMessage: AIMessage = messages[messages.length - 1];
  // console.log(lastMessage);
  if (lastMessage.tool_calls?.length) {
    return 'tools';
  }
  return '__end__';
}

const calculationGraph = new StateGraph(StateAnnotation)
  .addNode('callModel', callModel)
  .addNode('tools', calculationTool)
  .addEdge('__start__', 'callModel')
  .addConditionalEdges('callModel', routeModelOutput, ['tools', '__end__'])
  .addEdge('tools', 'callModel');

// const Calculator = calculationGraph.compile();

export const Calculator = calculationGraph.compile({
  // if you want to update the state before calling the tools
  // interruptBefore: [],
});