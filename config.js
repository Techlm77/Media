var config = {
  apiKey: "change-this",
  authDomain: "change-this",
  databaseURL: "change-this",
  projectId: "change-this",
  storageBucket: "change-this",
  messagingSenderId: "change-this",
  appId: "change-this",
  measurementId: "change-this"
  };
  firebase.initializeApp(config);
  firebase.auth.Auth.Persistence.LOCAL;
  
  $("#btn-login").click(function()
{
  var email = $("#email").val();
  var password = $("#password").val();
  if (email != "" && password != "")
  {
    var result = firebase.auth().signInWithEmailAndPassword(email, password);
    result.catch(function(error)
    {
      var errorCode = error.code;
      var errorMessage = error.message;
      console.log(errorCode);
      console.log(errorMessage);
      window.alert("Message : " + errorMessage);
    });
  }
  else
  {
    window.alert("Form is incomplete. Please fill out out all field.");
  }
});

$("#btn-signup").click(function()
{
  var email = $("#email").val();
  var password = $("#password").val();
  var cPassword = $("#confirmPassword").val();
  
  if (email != "" && password != "" && cPassword != "")
  {
    if(password == cPassword)
    {
      var result = firebase.auth().createUserWithEmailAndPassword(email, password);
    
      result.catch(function(error)
      {
        var errorCode = error.code;
        var errorMessage = error.message;
        
        console.log(errorCode);
        console.log(errorMessage);
        
        window.alert("Message : " + errorMessage);
      });
    }
    else
    {
      window.alert("Password do not match with the Confirm Password");
    }
  }
  else
  {
    window.alert("Form is incomplete. Please fill out out all field.");
  }
});

$("#btn-resetPassword").click(function()
{
var auth = firebase.auth();
var email = $("#email").val();

if(email != "")
{
  auth.sendPasswordResetEmail(email).then(function()
  {
    window.alert("Email has been sent to your, please check and verify.");
  })
  .catch(function(error)
  {
    var errorCode = error.code;
    var errorMessage = error.message;
    
    console.log(errorCode);
    console.log(errorMessage);
    
    window.alert("Message : " + errorMessage);
  });
}
else 
{
  window.alert("Please write your email first.");
}
});


$("#btn-logout").click(function()
{
firebase.auth().signOut();
});

$("#btn-update").click(function()
{
var fName = $("#firstName").val();
var sName = $("#secondName").val();
var gender = $("#gender").val();
var bio = $("#bio").val();


var rootRef = firebase.database().ref().child("Users");
var userID = firebase.auth().currentUser.uid;
var usersRef = rootRef.child(userID);

if(fName!="" && sName!="" && gender!="" && bio!="")
{
  var userData = {
    "firstName": fName,
    "secondName": sName,
    "gender": gender,
    "bio": bio

  };

  usersRef.set(userData, function(error)
  {
    if(error)
    {
      var errorCode = error.code;
      var errorMessage = error.message;
      
      console.log(errorCode);
      console.log(errorMessage);
      
      window.alert("Message : " + errorMessage);
    }
    else
    {
      window.location.href = "MainPage.html";
    }
  });
}
else
{
  window.alert("Please write your email first.");
}
});

function switchView(view)
{
$.get({
  url:view,
  cache:false,

})
.then(function(data)
{
  $("#Post").html(data);
});
}