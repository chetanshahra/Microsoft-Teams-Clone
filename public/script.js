const socket = io("/");
const videoGrid = document.getElementById('video-grid');
const partcipantList = document.getElementById('participants__list');
const myVideo = document.createElement('video');
myVideo.muted = true;

var peer = new Peer(undefined, {
    path: "/peerjs",
    host: '/',
    port: '443'
});
const peers = {}
let myVideoStream
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    peer.on('call', call => {
        call.answer(stream)
        const video = document.createElement('video')
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream);
        })
    })
    socket.on("user-connected", (userId) => {
        setTimeout(function () {
          connectToNewUser(userId, stream);
        }, 1000);
    });
  let text = $("input");
  $('html').keydown(function (e) {
    if (e.which == 13 && text.val().length !== 0) {
      const msgg = {
        message: text.val(),
        sentBy: uName
      }
      socket.emit('message', msgg);
      text.val('')
    }
  });
    socket.on("createMessage", (message) => {
      console.log(message);
      $(".messages").append(`<li class="message"><br/><b>${message.sentBy}</b> : ${message.message}</li>`);
        scrollToBottom()
    })
})
socket.on('user-disconnected', userId => {
    if (peers[userId])
        peers[userId].close()
  })
peer.on('open', id => {
    console.log(id);
    socket.emit('join-room', ROOM_ID, id);
})


const connectToNewUser = (userId, stream) => {
    const call = peer.call(userId, stream);
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream)
    })
    call.on('close', () => {
        video.remove()
    })
    peers[userId] = call;
}
const addVideoStream = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    })
    videoGrid.append(video);
}
const scrollToBottom = () => {
    var d = $('.main__chat_window');
    d.scrollTop(d.prop("scrollHeight"));
  }

const unmutedHtml = `<i class="unmute fas fa-microphone-slash"></i><span>Unmute</span>`;
const mutedHtml = `<i class="fas fa-microphone"></i><span>Mute</span>`;
const playingVidHtml = `<i class="fas fa-video"></i><span>Stop Video</span>`;
const stoppedVidHtml = `<i class="stop fas fa-video-slash"></i><span>Play Video</span>`;  

const toggleMuteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    document.querySelector('.main__mute_button').innerHTML = unmutedHtml;
  } else {
    document.querySelector('.main__mute_button').innerHTML = mutedHtml;
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
}
  
  const togglePlayStop = () => {
    console.log('object')
    let enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
      myVideoStream.getVideoTracks()[0].enabled = false;
      document.querySelector('.main__video_button').innerHTML = stoppedVidHtml;
    } else {
      myVideoStream.getVideoTracks()[0].enabled = true;
      document.querySelector('.main__video_button').innerHTML = playingVidHtml;
    }
}