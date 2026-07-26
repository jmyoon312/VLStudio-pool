import os
import zipfile
import time
import logging

logger = logging.getLogger(__name__)

class ExportManager:
    def __init__(self):
        self.temp_dir = os.path.join(os.getcwd(), "temp")
        os.makedirs(self.temp_dir, exist_ok=True)

    def create_batch_zip(self, file_paths: list, output_filename: str) -> str:
        """
        Creates a ZIP file containing the specified files.
        Returns the absolute path to the generated ZIP file.
        """
        zip_path = os.path.join(self.temp_dir, output_filename)
        
        try:
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for file_path in file_paths:
                    if isinstance(file_path, tuple):
                        src_path, arc_name = file_path
                        if os.path.exists(src_path):
                            zipf.write(src_path, arcname=arc_name)
                        else:
                            logger.warning(f"File not found for zipping: {src_path}")
                    else:
                        if os.path.exists(file_path):
                            zipf.write(file_path, arcname=os.path.basename(file_path))
                        else:
                            logger.warning(f"File not found for zipping: {file_path}")
            
            logger.info(f"Created ZIP file: {zip_path}")
            return zip_path
        except Exception as e:
            logger.error(f"Failed to create ZIP file: {e}")
            raise e
