# Usar imagen oficial de Python
FROM python:3.11-slim

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivo de requisitos
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto de archivos de la aplicación
COPY . .

# Exponer puerto 5000 (solo para documentación, no se usa externamente)
EXPOSE 5000

# Comando para ejecutar la aplicación
CMD ["python", "app.py"]
