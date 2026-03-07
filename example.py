### pip install langgraph-sdk
### pip install python-dotenv
from langgraph_sdk import get_client
from dotenv import load_dotenv
import os
import asyncio
import time

load_dotenv()
url = os.getenv("base_url", "http://localhost:8123")
api_key = os.getenv("api_key")
client = get_client(url=url, api_key=api_key)

# 生产环境用
async def question_generation():
    final_state_of_run = await client.runs.wait(
        thread_id=None,
        assistant_id="quiz_agent",
        input={
            "knowledge_point_name": "体积混合比定义",  # 知识点名称
            "knowledge_content": "体积混合比是某组分摩尔数与空气总摩尔数之比，单位通常为ppm、ppb、ppt，当空气密度变化时保持恒定。", # 知识点内容
            "sample_questions": [
                "问题： 单选题）下列哪种浓度表示方法在空气被压缩或膨胀时保持不变？A. 数浓度 B. 质量浓度 C. 体积混合比 D. 分压 答案：C",

                "问题： （判断题）质量混合比与体积混合比在数值上总是相等的。 答案：错误",

                "问题：计算题）若CO₂的体积混合比为400 ppm，求其在标准大气压(1013 hPa)和25°C条件下的数浓度(molecules/cm³)。 答案：n = (P/RT)×N_A×χ = (101300/(8.314×298))×6.022×10²³×400×10⁻⁶ ≈ 9.76×10¹⁵ molecules/cm³"
            ],  # 示例问题及答案
            "user_context": 
            {
                "grade":"博士1年级",
                "major":"经济学",
                "major_background":"不具备任何环境领域经验",
                "grasp_level":'完全不懂',
                "history":[''],
            }
        }
        )
    return final_state_of_run['output']

start_time = time.time()
question = asyncio.run(question_generation()) # list of questions
end_time = time.time()
elapsed_time = end_time - start_time

print(f"生成问题耗时: {elapsed_time:.2f} 秒")
print(question)
