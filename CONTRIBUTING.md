# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement (CLA). You (or your employer) retain the copyright to your
contribution; this simply gives us permission to use and redistribute your
contributions as part of the project. Head over to
<https://cla.developers.google.com/> to see your current agreements on file or
to sign a new one.

You generally only need to submit a CLA once, so if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Community Guidelines

This project follows
[Google's Open Source Community Guidelines](https://opensource.google/conduct/).

## Contribution Workflow

If you are a direct contributor, then please request access to collaborate on this repository, so you can work directly on the project using feature branches.

After you have gained direct contributor access, you may follow this example workflow to get started:

```sh
# grab the dev branch, after you create your local dev, this just becomes git checkout dev
> git checkout -b dev origin/dev 
# make sure you're local repo is up to date
> git pull --all 
> git checkout -b feature-branch-name origin/dev
# then make and stage your changes
> git add . 
> git commit -m "Your first commit message"
> git push -u origin feature-branch-name
# You can now create a PR in github 
```
Otherwise, please create and maintain a fork.