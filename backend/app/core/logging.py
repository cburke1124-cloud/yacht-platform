import logging
from pathlib import Path

def setup_logging(
    log_level: str = "INFO",
    log_file: str = "logs/yachtversal.log",
    json_logs: bool = False
):
    Path("logs").mkdir(exist_ok=True)

    logger = logging.getLogger("yachtversal")
    logger.setLevel(getattr(logging, log_level.upper()))

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    try:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)
    except Exception:
        file_handler = None

    if json_logs:
        formatter = logging.Formatter(
            '{"timestamp": "%(asctime)s", "level": "%(levelname)s", '
            '"module": "%(module)s", "message": "%(message)s"}'
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )

    console_handler.setFormatter(formatter)
    if file_handler:
        file_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    if file_handler:
        logger.addHandler(file_handler)

    return logger