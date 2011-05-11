from google.appengine.ext import webapp
from google.appengine.api import users
from google.appengine.ext.webapp.util import run_wsgi_app

import simplejson

class GetUserInfo(webapp.RequestHandler):
    def get(self):
        self.response.headers['Content-Type'] = 'application/json'

        user = users.get_current_user()
        if user is None:
            self.response.out.write(simplejson.dumps({'login': users.create_login_url("/")}))
        else:
            self.response.out.write(simplejson.dumps({'user': user.nickname()}))

application = webapp.WSGIApplication([('/public/v1/myinfo', GetUserInfo)])

if __name__ == "__main__":
    run_wsgi_app(application)
