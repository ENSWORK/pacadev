FROM odoo:17

USER root
# wkhtmltopdf patché (avec Qt patché) — requis pour header/footer PDF Odoo
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends curl fontconfig libxrender1 xfonts-75dpi xfonts-base \
    && curl -fsSL https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.jammy_amd64.deb -o /tmp/wkhtmltox.deb \
    && dpkg -i /tmp/wkhtmltox.deb \
    && rm /tmp/wkhtmltox.deb \
    && rm -rf /var/lib/apt/lists/*

USER odoo
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
