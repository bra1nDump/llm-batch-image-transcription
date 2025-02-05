PLAN and next write a cli tool that solved the problem of LLMs refusing to create very large outputs at once, truncating, summarising, and otherwise failing to process very large inputs given a prompt. Key thing here is the processing prompt is separate from the actual input being processed. 

I want the algorithm to be very simple. The processing prompt is always included in every llm call. For the input there's a sliding window.


All the parts marked above as "in" will be included in the llm prompt

the prompt should be constructed using best prompt engineering principles. You should create a function that will given hyperparameters (window sizes, extended window trailing and leading edges) and input and partial output, processing prompt, should return a full prompt that communicates to the llm about its task that is given for the entirety of the transformation, and finally 

The prompt should look like this roughly

"""
You are a natural language processor that works with unusually large inputs and outputs that do not work well in a single request. You will be given a chunk of your input and a task to transform this input chunk to a corresponding output chunk. You will be invoked slowly to build up the final output.

Think of yourself as slowly transforming a large continous input text to another large continues output text using a sliding window, with some look back and forward in your input and look back in our output. Here is the rough diagram:

input:
[-<out of context>-[-<look back, already processed>-[-<chunk being procssed now>-]-<look foward, will be included in next chunk>-]-<out of context>-]
output:
[-<out of context>-[-<look back, already generated in previous run>-]-<unknown, not yet produced>-]

You can decide to stop generation of the current chunk wherever it makes the most sense, as long as it close to the end boundary of that chunk, because chunking mechanism is dumb and you need to smoothen the edges to ensure all input is correctly processed. This is one of the reasons you are provided with look back / forward mechanisms to do this near the edge gluing corectly. The chunks you output have to be simply concatenatable. In other words the output should be as if the llm just processed the whole input in one go successfully. In reality the output will be constructed like so: "".join(output_chunks). So made sure you don't skip any separators applicable between chunks.

<task>
${processing_prompt}
</task>

<input-look-back>
${look_back}
</input-look-back>

<input-chunk-to-process>
${input_chunk_to_process}
</input-chunk-to-process>

<input-look-forward>
${look_forward}
</input-look-forward>

<output-look-back>
${output_look_back}
</output-look-back>

Output exactly the next chunk of the output, do not include any other text.
"""

reads two files and is cold like this
llm-long <input file name>, for example a transcript