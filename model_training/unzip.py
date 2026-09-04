import zipfile
import os

# Replace with your actual downloaded file name
zip_path = "archive.zip" 
extract_path = "thermal_dataset"

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_path)