import os
import subprocess
import time
import platform
import logging

logger = logging.getLogger(__name__)

class ClaudeBridge:
    """
    ViraLoop의 메인 백엔드(Celery 등)와 독립된 OpenClaude(bun) 런타임을 
    이어주는 무중단/재시도 통신 클래스. 에이전트 간의 작업을 강력하게 감독합니다.
    [UPGRADE] 플랫폼 독립화 (Windows/Linux/Mac)
    """
    def __init__(self, workspace_path):
        self.workspace_path = workspace_path
        self.max_retries = 3
        self.system = platform.system()
        
        self._setup_paths()
    
    def _setup_paths(self):
        """플랫폼에 따른 경로 설정"""
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        
        if self.system == "Windows":
            self.openclaude_path = os.path.join(project_root, "openclaw", "node_modules", ".bin", "openclaude.cmd")
            self.skills_base = os.path.join(project_root, "openclaw", "skills")
        else:
            self.openclaude_path = os.path.join(project_root, "openclaw", "node_modules", ".bin", "openclaude")
            self.skills_base = os.path.join(project_root, "openclaw", "skills")
        
        if not os.path.exists(self.openclaude_path):
            self.openclaude_path = "openclaude"
            logger.warning(f"OpenClaw not found at {self.openclaude_path}, using PATH")
    
    def run_agent_command(self, agent_name, prompt):
        """
        명령 프롬프트를 인젝션하여 Claude를 서브프로세스로 구동하고
        API Limit이나 에러 발생 시 재시도 로직(Exponential Backoff)을 수행합니다.
        """
        skill_path = os.path.join(self.skills_base, agent_name, "SKILL.md")
        
        if not os.path.exists(skill_path):
            logger.warning(f"Skill path not found: {skill_path}, skipping skill injection")
            skill_path = None
        
        cmd = [
            self.openclaude_path,
            "-p", f"작업 공간: {self.workspace_path}"
        ]
        
        if skill_path:
            cmd.append(f"룰(SKILL.md)을 준수할 것: {skill_path}")
        
        cmd.append(f"명령: {prompt}")
        
        logger.info(f"[Claude Bridge] Executing: {' '.join(cmd[:3])}...")
        
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(f"[Claude Bridge] Attempt {attempt} for {agent_name}...")
                res = subprocess.run(
                    cmd, 
                    capture_output=True, 
                    text=True, 
                    timeout=300,
                    cwd=self.workspace_path
                )
                if res.returncode == 0:
                    return res.stdout
                else:
                    logger.error(f"Error: {res.stderr}")
            except subprocess.TimeoutExpired:
                logger.warning(f"[Claude Bridge] {agent_name} process timed out.")
            except FileNotFoundError:
                logger.error(f"[Claude Bridge] OpenClaw not found: {self.openclaude_path}")
                return None
            
            wait_time = attempt * 5
            logger.info(f"Retrying in {wait_time} seconds...")
            time.sleep(wait_time)
        
        return None