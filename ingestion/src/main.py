"""Placeholder ingestion worker entrypoint."""

import time


def main() -> None:
    print("Ingestion worker idle. Implement pipeline in future milestones.")
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
