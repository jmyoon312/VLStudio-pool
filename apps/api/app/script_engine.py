import logging
from .llm_manager import LLMClient
from .database import SessionLocal
from . import crud, models

# Configure Logging
logger = logging.getLogger(__name__)

class ScriptEngine:
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    def _get_default_model(self):
        db = SessionLocal()
        try:
            settings = crud.get_settings(db)
            # Use DB setting only. If empty, the caller or UI will handle the selection.
            return settings.default_model if settings and settings.default_model else ""
        finally:
            db.close()

    def generate_script(self, input_text: str, style_instruction: str, niche: str = None, sample_text: str = None, glossary: str = None, provider: str = None, model: str = None, wisdom: str = None, use_web_search: bool = False):
        """
        Generates a YouTube script based on the input text and style.
        [SOVEREIGN V7] Upgraded with Elite Intelligence and DNA-First Logic.
        [ENHANCED] Web search research + Trend data injection for real-time accuracy.
        """
        # [ELITE MODEL ESCALATION] 
        # Default to high-tier intelligence available in the user's environment.
        if not provider:
            provider = "opencode"
        if not model:
            model = "opencode/deepseek-v4-flash-free"

        logger.info(f"[SCRIPT] [Elite Gen] Niche={niche}, Input={input_text[:50]}..., Model={model}")
        
        # 1. Specialized Persona Injection (Sovereign Specialist)
        specialist_persona = ""
        niche_lower = str(niche).lower() if niche else ""
        topic_lower = input_text.lower()
        
        if any(x in niche_lower or x in topic_lower for x in ["senior", "health", "elder", "medical", "시니어", "건강", "노인", "실버"]):
            specialist_persona = (
                "### [SPECIALIST ACTIVATED] SENIOR HEALTH & WELLNESS EXPERT:\n"
                "너는 30년 경력의 시니어 전문 보건 의료인이자 콘텐츠 기획자다.\n"
                "- 시니어 계층이 신뢰할 수 있는 차분하면서도 명확한 어조를 유지하라.\n"
                "- 그들의 건강 고민(관절, 당뇨, 인지력 등)에 깊이 공감하고 실질적인 해결책을 제시하라.\n"
                "- 과장된 표현보다 과학적 근거와 따뜻한 조언을 결합하여 권위와 친근함을 동시에 확보하라.\n\n"
            )

        # 2. Flavor Substrate (Sovereign v7.0)
        flavor_rule = (
            "### [SOVEREIGN V7] SEMANTIC FLAVOR RULE:\n"
            "AI 특유의 딱딱하고 반복적인 문체를 철저히 배제하고, 한국어 특유의 '말맛'과 '정서'를 살려라.\n"
            "- 시각적/청각적 의성어와 의태어를 적극적으로 활용하라 (예: '심장이 콩닥콩닥', '무릎이 욱신할 때').\n"
            "- 1인칭 시점의 체험적 묘사를 추가하여 '사람이 직접 경험하고 쓴 것 같은' 생동감을 부여하라.\n"
            "- 쇼츠 특유의 빠른 호흡과 리드미컬한 문장 배치를 유지하라.\n\n"
        )

        # 3. DNA-FIRST WISDOM (Reference Channel Patterns)
        wisdom_text = ""
        if wisdom:
            wisdom_text = f"### [CORE DNA - MUST FOLLOW] REFERENCE CHANNEL PATTERNS:\n{wisdom}\n\n"
        elif niche:
            try:
                from app.services.intelligence.wisdom import WisdomDistiller
                db = SessionLocal()
                distiller = WisdomDistiller(db)
                wisdom_text = distiller.get_wisdom_for_niche(niche)
                db.close()
                if wisdom_text:
                    wisdom_text = f"### [CORE DNA - MUST FOLLOW] REFERENCE CHANNEL PATTERNS:\n{wisdom_text}\n\n"
            except Exception as e:
                logger.warning(f"Could not fetch wisdom for niche {niche}: {e}")

        # 4. Style Guidelines
        style_text = ""
        if style_instruction:
            style_text = f"### [STYLE PRESET] AUTHOR GUIDELINES:\n{style_instruction}\n\n"
        
        if sample_text:
            style_text += f"### [STYLE SAMPLE] REFERENCE TEXT:\n{sample_text}\n\n"

        # 5. SEO Optimization via Real-time Trends
        seo_text = ""
        if niche:
            try:
                from app.services.scraper_engine import ScraperEngine
                scraper = ScraperEngine()
                suggestions = scraper.get_youtube_autocomplete(niche, limit=5)
                if suggestions:
                    seo_text = (
                        "### [SEO OPTIMIZATION] REAL-TIME TRENDING KEYWORDS:\n"
                        "다음은 현재 YouTube에서 가장 많이 검색되는 연관 키워드입니다. 대본 본문에 자연스럽게 녹여내어 알고리즘 노출을 극대화하세요:\n"
                        f"{', '.join(suggestions)}\n\n"
                    )
            except Exception as e:
                logger.warning(f"Failed to fetch SEO trends for {niche}: {e}")

        # 6. [NEW] Web Search Research — real-time facts for accurate scripts
        web_research_text = ""
        research_used = False
        research_summary = None
        research_sources = None
        if use_web_search:
            try:
                from app.services.tool_manager import tool_manager
                db = SessionLocal()
                settings = crud.get_settings(db)
                db.close()
                search_query = f"{input_text} {niche or ''} facts statistics 2026"
                search_result = tool_manager.search(search_query, include_images=False, settings=settings, time_range='year')
                results = search_result.get("results", [])
                if results:
                    research_used = True
                    top5 = results[:5]
                    research_sources = [r['title'] for r in top5]
                    research_summary = " | ".join(f"{r['title']}: {r['content'][:100]}" for r in top5)
                    web_research_text = "### [WEB RESEARCH] REAL-TIME FACTS & DATA:\n"
                    web_research_text += "다음은 웹에서 수집한 최신 사실과 데이터입니다. 대본에 구체적인 숫자, 통계, 사례를 인용할 때 활용하고 출처를 표기하세요:\n"
                    for idx, res in enumerate(top5):
                        web_research_text += f"- {res['title']}: {res['content'][:300]}\n"
                    web_research_text += "\n"
            except Exception as e:
                logger.warning(f"Web research failed for '{input_text}': {e}")

        # 7. [NEW] Trend Data Injection — viral angles from Trend table
        trend_text = ""
        trend_used = False
        trend_count = 0
        if niche:
            try:
                db = SessionLocal()
                trend = db.query(models.Trend).filter(models.Trend.category.ilike(f"%{niche}%")).order_by(models.Trend.updated_at.desc()).first()
                db.close()
                if trend and trend.related_keywords_json:
                    keywords = trend.related_keywords_json
                    if isinstance(keywords, list) and len(keywords) > 0:
                        trend_used = True
                        trend_count = len(keywords)
                        trend_text = "### [TREND INTELLIGENCE] VIRAL KEYWORDS & ANGLES:\n"
                        trend_text += "다음은 현재 이 니치에서 바이럴 중인 키워드와 각도입니다. 대본에 반영하면 조회수 상승에 도움이 됩니다:\n"
                        for kw in keywords[:5]:
                            ko = kw.get("ko", "")
                            en = kw.get("en", "")
                            score = kw.get("viral_score", 0)
                            velocity = kw.get("velocity", "")
                            angle = kw.get("angle", "")
                            trend_text += f"- {ko} ({en}) [Score: {score}, Velocity: {velocity}]\n  Angle: {angle}\n"
                        trend_text += "\n"
            except Exception as e:
                logger.warning(f"Trend data fetch failed for niche {niche}: {e}")

        system_prompt = (
            "You are an Elite Creative Broadcast Writer for high-retention viral YouTube Shorts.\n\n"
            "### [CONSTITUTION] THE DNA RULE:\n"
            "위에 제공된 [CORE DNA]는 이 채널의 성공 법칙이다. 이를 무시하지 말고, 반드시 해당 스타일과 톤을 최우선으로 반영하여 집필하라.\n\n"
            f"{specialist_persona}"
            f"{flavor_rule}"
            f"{wisdom_text}"
            f"{style_text}"
            f"{seo_text}"
            f"{web_research_text}"
            f"{trend_text}"
            "### CORE SCRIPTWRITING RULES:\n"
            "1. **Direct Address**: Always speak directly to the viewer (e.g., '여러분', '지휘관님', '어르신들').\n"
            "2. **Information Density**: Extract specific facts or tips from the DNA/context. No vague summaries.\n"
            "3. **Hook, Meat, Call-to-Action**: High-energy hook (3s), core value (20s), and a sharp closing with engagement prompt.\n"
            "4. **Full Completion**: Ensure the script has a clear beginning, middle, and end. DO NOT truncate.\n\n"
            "### CRITICAL OUTPUT RULES:\n"
            "1. Output ONLY the raw Korean script. No scene labels, no markdown, no intro/outro chatter.\n"
            "2. Every single character you output MUST be spoken by the narrator.\n"
            "3. Target Duration: 30-50 seconds of fast-paced speech.\n\n"
        )

        user_prompt = f"### INPUT TOPIC/MATERIAL:\n{input_text}"
        
        fallback_providers = [
            (provider, model),
            ("opencode", "opencode/deepseek-v4-flash-free"),
            ("groq", "groq/llama-3.3-70b-versatile"),
        ]
        
        last_error = None
        for fb_provider, fb_model in fallback_providers:
            try:
                result = self.llm_client.generate_content(
                    prompt=user_prompt, 
                    model_name=fb_model,
                    system_instruction=system_prompt,
                    full_response=True
                )
                
                actual_model = result.get("model", fb_model) if isinstance(result, dict) else fb_model
                content = result.get("content", result) if isinstance(result, dict) else result
                
                logger.info(f"[OK] Script generated successfully using {actual_model}.")
                
                warning = None
                if actual_model != model:
                    warning = f"System: Used {actual_model} instead of {model}."

                return {
                    "script": content,
                    "model_used": actual_model,
                    "warning": warning,
                    "research_used": research_used,
                    "research_summary": research_summary,
                    "research_sources": research_sources,
                    "trend_used": trend_used,
                    "trend_count": trend_count
                }
            except Exception as e:
                last_error = e
                logger.warning(f"[WARN] {fb_provider}/{fb_model} failed: {e}. Trying next fallback...")
                continue
        
        logger.error(f"[FAIL] All providers failed. Last error: {last_error}")
        raise last_error or Exception("All script generation providers failed.")

    def refine_script(self, current_text: str, instruction: str, persona: str = None, style_instruction: str = None, sample_text: str = None, provider: str = None, model: str = None, tempo_percentage: int = 100):
        """
        Refines an existing script based on user instruction and style guidelines.
        Returns a dictionary: {"script": str, "model_used": str, "warning": str|None}
        """
        if not provider:
            provider = "opencode"
        if not model:
            model = "opencode/deepseek-v4-flash-free"

        logger.info(f"[MAGIC] Script Refinement Request: Persona={persona}, Instruction='{instruction}', Tempo={tempo_percentage}%, Style={bool(style_instruction)}")
        
        persona_map = {
            "strategist": (
                "You are an Elite YouTube Strategist and CEO. Your tone is logical, data-driven, authoritative, and direct. "
                "You strip away all fluff. You focus on retention, CTR, and absolute clarity. Speak like a person who commands results."
            ),
            "influencer": (
                "You are a top-tier Viral Influencer with 50M followers. Your tone is trendy, explosive, relatable, and high-energy. "
                "You know exactly what makes people stop scrolling. Use dopamine-inducing hooks, emotional spikes, and internet-native nuances. "
                "Make the script feel alive and impossible to ignore."
            ),
            "educator": (
                "You are a Master Educator and world-renowned Expert. Your tone is calm, trust-inspiring, clear, and methodical. "
                "You turn complex ideas into 'Aha!' moments. You build long-term authority and deep viewer trust through precision and wisdom."
            )
        }
        
        # If style_instruction is provided (e.g. from a custom Persona/Style), use it as the primary persona
        if style_instruction:
            persona_instruction = f"### [PRIMARY PERSONA ACTIVATED]\n{style_instruction}"
        else:
            persona_instruction = persona_map.get(persona, "You are a professional YouTube Script Editor.")
        
        # Style guidelines augmentation (if any extra context exists)
        sample_context = f"### [STYLE SAMPLE] REFERENCE TEXT:\n{sample_text}\n\n" if sample_text else ""

        tempo_adjustment = ""
        if tempo_percentage != 100:
            tempo_adjustment = f"\n### [CRITICAL TEMPO ADJUSTMENT]\nPlease adjust the length of the script to approximately {tempo_percentage}% of its current word count. "
            if tempo_percentage < 100:
                tempo_adjustment += "Make it more concise and punchy, removing unnecessary words while keeping the core message and persona voice."
            else:
                tempo_adjustment += "Expand on the details, add more descriptive language or context to make it longer while maintaining interest and persona voice."

        system_prompt = (
            f"{persona_instruction}\n\n"
            "### YOUR MISSION:\n"
            "You are the world's best Script Doctor. Your task is to transform the provided script into a masterpiece based on the specific INSTRUCTIONS and your ACTIVATED PERSONA.\n\n"
            "### CRITICAL RULES:\n"
            "1. **MANDATORY LANGUAGE**: You MUST respond in **Korean**. Even if the input is English, deliver a polished Korean script.\n"
            "2. **VOICE CONSISTENCY**: Do not just fix grammar. Re-write the script to match the activated persona's unique voice, energy, and vocabulary.\n"
            "3. **OUTPUT FORMAT**: Provide ONLY the refined script text. No meta-talk, no headers, no markdown blocks.\n\n"
            f"{sample_context}"
            f"{tempo_adjustment}"
        )
        
        user_prompt = (
            "### INSTRUCTION:\n"
            f"{instruction}\n\n"
            "### CURRENT SCRIPT:\n"
            f"{current_text}\n\n"
            "### FINAL POLISHED KOREAN SCRIPT:\n"
        )
        
        try:
            result = self.llm_client.generate_content(
                prompt=user_prompt,
                model_name=model,
                system_instruction=system_prompt,
                full_response=True
            )
            
            actual_model = result.get("model", model) if isinstance(result, dict) else model
            content = result.get("content", result) if isinstance(result, dict) else result
            
            logger.info("[OK] Script refined successfully.")
            
            warning = None
            # Check if models are different, ignoring provider prefixes like 'google/'
            clean_actual = actual_model.split("/")[-1] if "/" in actual_model else actual_model
            clean_requested = model.split("/")[-1] if model and "/" in model else model
            
            if clean_actual != clean_requested:
                warning = f"System: Auto-switched to {actual_model} due to error with {model}."

            return {
                "script": content,
                "model_used": actual_model,
                "warning": warning
            }
        except Exception as e:
            logger.error(f"[FAIL] Script refinement failed with {model}: {e}")
            raise e

    def safety_review_script(self, current_text: str, provider: str = None, model: str = None):
        """
        Performs a safety review on the script, suggesting changes and returning a JSON.
        """
        if not provider:
            provider = "opencode"
        if not model:
            model = "opencode/deepseek-v4-flash-free"

        system_prompt = (
            "You are an expert Safety and Compliance Editor for YouTube content.\n"
            "Your task is to review the provided script and replace any harsh, dangerous, explicit, or non-advertiser-friendly language with soft, family-friendly alternatives.\n\n"
            "### CRITICAL RULES:\n"
            "1. You MUST output ONLY valid JSON format.\n"
            "2. Do not include markdown code blocks like ```json in the output.\n"
            "3. Ensure the 'revised_script' contains the fully modified text.\n"
            "4. For every change made, add an entry to the 'changes' array with 'original', 'replacement', and 'reason'.\n"
            'Example output:\n'
            '{\n'
            '  "revised_script": "This is a very nice script.",\n'
            '  "changes": [\n'
            '    {"original": "bad word", "replacement": "nice", "reason": "Family friendly"}\n'
            '  ]\n'
            '}'
        )

        user_prompt = f"### CURRENT SCRIPT:\n{current_text}"

        try:
            import json
            result = self.llm_client.generate_content(
                prompt=user_prompt,
                model_name=model,
                system_instruction=system_prompt,
                full_response=True
            )
            
            content = result.get("content", result) if isinstance(result, dict) else result
            
            # Clean markdown JSON formatting if present
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
                
            parsed_data = json.loads(content.strip())
            return parsed_data
        except Exception as e:
            logger.error(f"[FAIL] Safety review failed: {e}")
            raise e

    def generate_multilingual_script(self, input_text: str, niche: str = None, provider: str = None, model: str = None):
        """
        [Phase 3] Day-1 Global Localization
        Generates fully localized scripts, hooks, and metadata in 4 languages: Korean, English, Japanese, and Spanish.
        Outputs a strictly formatted JSON.
        """
        if not provider:
            provider = "google"
        if not model:
            model = "gemini-2.0-flash-exp"

        logger.info(f"🌍 Multilingual Script Gen Request: Niche={niche}, Input Length={len(input_text)}")
        
        flavor_rule = (
            "### [SOVEREIGN V7] MULTILINGUAL FLAVOR RULE:\n"
            "You are a master YouTube strategist targeting four specific global markets (Korea, Global/US, Japan, Spain/LatAm).\n"
            "For each market, you must deeply localize the Hook (first 3 seconds) and Script to match the cultural nuances and internet slang.\n"
            "Korea: Fast-paced, sensory '말맛', trendy.\n"
            "Global/English: High-energy, direct, dopamine-driven hooks.\n"
            "Japan: Anime-style exaggerated reactions or subtle deep-dive documentary style, depending on the topic.\n"
            "Spanish/LatAm: Passionate, emotional storytelling, highly expressive.\n\n"
        )

        system_prompt = (
            f"{flavor_rule}"
            "### TASK:\n"
            "Rewrite the provided input into a highly engaging YouTube script concurrently in 4 languages.\n"
            "For each language, provide:\n"
            "- 'title': A click-worthy, viral YouTube title.\n"
            "- 'hook': The first 1-3 sentences designed to maximize retention.\n"
            "- 'script': The main body of the script.\n"
            "- 'thumbnail_text': 1-3 words of impact text to put on the thumbnail.\n\n"
            "### CRITICAL OUTPUT RULES:\n"
            "You MUST output valid, raw JSON only. Do not include markdown formatting (like ```json), no intro, no outro.\n"
            "The JSON structure must exactly match this format:\n"
            "{\n"
            '  "ko": {"title": "", "hook": "", "script": "", "thumbnail_text": ""},\n'
            '  "en": {"title": "", "hook": "", "script": "", "thumbnail_text": ""},\n'
            '  "ja": {"title": "", "hook": "", "script": "", "thumbnail_text": ""},\n'
            '  "es": {"title": "", "hook": "", "script": "", "thumbnail_text": ""}\n'
            "}\n"
        )

        user_prompt = f"### INPUT TEXT:\n{input_text}"
        
        try:
            result = self.llm_client.generate_content(
                prompt=user_prompt, 
                model_name=model,
                system_instruction=system_prompt,
                full_response=True
            )
            
            actual_model = result.get("content", "") if isinstance(result, str) else result.get("model", model)
            content = result.get("content", result) if isinstance(result, dict) else result
            
            # Clean JSON formatting if LLM still included markdown
            if isinstance(content, str):
                content = content.replace('```json', '').replace('```', '').strip()
                import json
                try:
                    parsed_content = json.loads(content)
                except json.JSONDecodeError:
                    logger.error("Failed to parse Multilingual JSON output.")
                    parsed_content = {"error": "Invalid output format", "raw": content}
            else:
                parsed_content = content
            
            warning = None
            if actual_model != model:
                warning = f"System: Auto-switched to {actual_model} due to error with {model}."

            return {
                "localized_scripts": parsed_content,
                "model_used": actual_model,
                "warning": warning
            }
        except Exception as e:
            logger.error(f"[FAIL] Multilingual generation failed with {model}: {e}")
            raise e
    def safety_review_script(self, current_text: str, provider: str = None, model: str = None) -> dict:
        """
        Analyzes the script for safety/policy violations (TikTok/Douyin standards) 
        and suggests replacements.
        """
        if not provider: provider = "opencode"
        if not model: model = "opencode/deepseek-v4-flash-free"

        logger.info(f"🛡️ Safety Review Requested for {len(current_text)} chars")

        system_prompt = (
            "You are a Content Safety and Policy Expert for TikTok and YouTube Shorts.\n"
            "Your task is to analyze the provided Korean script and identify any words or phrases that violate community guidelines (e.g., violence, gore, excessive swearing, sexual content, self-harm, hate speech).\n\n"
            "### RULES:\n"
            "1. ONLY identify problematic words/phrases. Do NOT rewrite the entire script from scratch unless necessary.\n"
            "2. For each identified issue, provide a safe `replacement` and a brief `reason` in Korean.\n"
            "3. Finally, provide the `revised_script` with all replacements applied.\n"
            "4. Output MUST be raw JSON without markdown formatting.\n\n"
            "### JSON SCHEMA:\n"
            "{\n"
            '  "revised_script": "The full script with safe words applied",\n'
            '  "changes": [\n'
            '    {\n'
            '      "original": "problematic word/phrase",\n'
            '      "replacement": "safe alternative",\n'
            '      "reason": "Why it violates policy"\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        user_prompt = f"### SCRIPT TO REVIEW:\n{current_text}"
        
        try:
            result = self.llm_client.generate_content(
                prompt=user_prompt, 
                model_name=model,
                system_instruction=system_prompt,
                full_response=True
            )
            
            content = result.get("content", result) if isinstance(result, dict) else result
            
            # Parse JSON
            if isinstance(content, str):
                content = content.replace('```json', '').replace('```', '').strip()
                import json
                try:
                    parsed = json.loads(content)
                except json.JSONDecodeError:
                    logger.error("Failed to parse Safety Review JSON.")
                    parsed = {"revised_script": current_text, "changes": []}
            else:
                parsed = content

            return parsed
        except Exception as e:
            logger.error(f"[FAIL] Safety review failed: {e}")
            raise e

    def segment_to_beats(self, script: str, provider: str = None, model: str = None):
        """
        [ELITE ORCHESTRATION]
        Analyzes a refined script and segments it into dynamic mission beats.
        Identifies logical scene breaks, emotional pivots, and visual intents.
        """
        if not provider:
            provider = "opencode"
        if not model:
            model = "opencode/deepseek-v4-flash-free"

        logger.info(f"🧬 [Elite Orchestration] Segmenting script into beats (Length: {len(script)})")

        system_prompt = (
            "You are an Elite Video Production Orchestrator. Your task is to analyze the provided Korean script and break it down into logical, high-impact video segments (Beats).\n\n"
            "### RULES:\n"
            "1. **NO FIXED TEMPLATES**: Do not force a Hook-Problem-CTA structure. Follow the natural story arc of the script.\n"
            "2. **IDENTIFY PIVOTS**: Create a new beat whenever there is a shift in topic, emotion, or visual context.\n"
            "3. **VISUAL & AUDIO INTENT**: For each beat, define a 'visual_intent' (e.g., 'Cinematic Close-up', 'Motion Graphics Overlay') and an 'audio_intent' (e.g., 'Bass Drop', 'Whispering Narration', 'Fast Tempo Drums').\n"
            "4. **EMOTIONAL TONE**: Define the 'emotional_tone' (e.g., 'Urgent', 'Inspirational', 'Mysterious') to guide the production style.\n"
            "5. **DURATION**: Suggest a duration in seconds for each beat (total should be around 30-60s).\n"
            "6. **OUTPUT FORMAT**: You MUST output raw JSON only. No markdown.\n\n"
            "### JSON SCHEMA:\n"
            "[\n"
            "  {\n"
            '    "id": "beat-1",\n'
            '    "type": "string (e.g., hook, problem, tension, climax, resolution, cta)",\n'
            '    "title": "Short descriptive title in Korean",\n'
            '    "subtitle": "Brief strategic goal in Korean",\n'
            '    "text_overlay": "The exact script text for this segment in Korean",\n'
            '    "duration_sec": 5.0,\n'
            '    "visual_intent": "Production instruction in English",\n'
            '    "audio_intent": "Sound design instruction in English",\n'
            '    "emotional_tone": "Strategic emotional trigger in English"\n'
            "  }\n"
            "]"
        )

        user_prompt = f"### REFINED SCRIPT:\n{script}"

        try:
            result = self.llm_client.generate_content(
                prompt=user_prompt,
                model_name=model,
                system_instruction=system_prompt,
                full_response=True
            )
            
            content = result.get("content", result) if isinstance(result, dict) else result
            
            if isinstance(content, str):
                content = content.replace('```json', '').replace('```', '').strip()
                import json
                try:
                    beats = json.loads(content)
                except json.JSONDecodeError:
                    logger.error("Failed to parse Segmentation JSON.")
                    beats = []
            else:
                beats = content

            logger.info(f"[OK] Successfully segmented script into {len(beats)} beats.")
            return beats
        except Exception as e:
            logger.error(f"[FAIL] Script segmentation failed: {e}")
            raise e

