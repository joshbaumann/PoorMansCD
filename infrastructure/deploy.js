const shell = require('shelljs');
const ssh2 = require('ssh2-promise');
const DigitalOcean = require('do-wrapper').default;

const DO_API_KEY = process.env.DO_API_KEY;
const DO_SSH_KEY = process.env.DO_SSH_KEY;
const DOCKER_USERNAME = process.env.DOCKER_USERNAME;
const DOCKER_PASSWORD = process.env.DOCKER_PASSWORD;

const DO = new DigitalOcean(DO_API_KEY);

(async () => {
  const { droplets } = await DO.droplets.getAll('poor-mans-server');
  const { ip_address } = droplets[0].networks.v4.find(address => address.type === 'public');

  const ssh = new ssh2({
    username: 'root',
    host: ip_address,
    identity: `${process.env.HOME}/.ssh/id_rsa`
  });

  const sftp = ssh.sftp();

  try {
    configureSshKey(ip_address);

    await ssh.connect();

    console.log('Copying files...');
    await sftp.fastPut('../.env.prod', '.env');
    await sftp.fastPut('../docker-compose.prod.yml', 'docker-compose.yml');
    await sftp.fastPut('./caddy/Caddyfile.prod', 'Caddyfile');

    console.log('Log into Docker...');
    await ssh.exec(`docker login --username=${DOCKER_USERNAME} --password=${DOCKER_PASSWORD} 2> /dev/null`);

    console.log('Pulling latest images...');
    await ssh.exec(`docker-compose pull -q`);

    console.log('Updating containers...');
    await ssh.exec(`docker-compose up -d --quiet-pull 2> /dev/null`);

    console.log('Cleaning up images...');
    await ssh.exec('docker image prune -f 2> /dev/null');
  } catch(e) {
    console.error(e.toString());
    process.exit(1);
  } finally {
    await ssh.exec('docker logout');
    await ssh.exec('history -c');
    await ssh.close();
    shell.exec('rm -rf ~/.ssh');
  }

  process.exit(0);
})();

function configureSshKey(ipAddress) {
  shell.exec(`mkdir ~/.ssh`);
  shell.exec(`echo "${DO_SSH_KEY}" > ~/.ssh/id_rsa`);
  shell.exec('chmod 400 ~/.ssh/id_rsa');
  shell.exec(`ssh-keyscan -t rsa ${ipAddress} >> ~/.ssh/known_hosts`);
}
