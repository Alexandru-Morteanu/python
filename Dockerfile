# Use an official Node.js runtime as a parent image
FROM node:20-bullseye

# Set the working directory in the container
WORKDIR /app

# Copy package.json and bun.lockb files to the working directory
COPY package.json bun.lockb ./

# Install bun
RUN npm install -g bun

# Copy the rest of your application code to the working directory
COPY . .

# Install Python and necessary libraries
RUN apt-get update && \
    apt-get install -y python3 python3-venv python3-dev libhdf5-dev && \
    python3 -m venv /app/venv

# Install supervisord
RUN apt-get install -y supervisor

# Activate the virtual environment and install Python packages
RUN /bin/bash -c "source /app/venv/bin/activate && pip install --no-cache-dir tensorflow==2.16.1 numpy==1.24.3 pillow==10.1.0"

# Install Bun dependencies
RUN bun install

# Copy supervisord configuration file
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose port 8088
EXPOSE 8088

# Command to run supervisord
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
