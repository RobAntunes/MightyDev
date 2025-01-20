from setuptools import setup, find_packages

setup(
    name="mighty-embeddings",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "numpy>=1.24.0",
        "torch>=2.0.0",
        "sentence-transformers>=2.2.0",
        "transformers>=4.30.0"
    ]
)